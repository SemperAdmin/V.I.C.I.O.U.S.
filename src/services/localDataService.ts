import bcrypt from 'bcryptjs'
import { sbGetUserByEdipi, sbVerifyPassword, sbGetProgressByMember, sbListMembers } from './supabaseDataService'

export interface LocalUserProfile {
  user_id: string
  edipi: string
  mos: string
  first_name?: string
  middle_initial?: string
  last_name?: string
  branch?: string
  rank?: string
  org_role: string
  is_unit_admin?: boolean
  is_app_admin?: boolean
  section_role?: 'Section_Reviewer' | 'Member'
  unit_id: string
  company_id?: string
  platoon_id?: string
  hashed_password: string
  created_at_timestamp: string
  updated_at_timestamp: string
}

export interface UsersIndexEntry {
  user_id: string
  edipi: string
  path: string
}

export interface SubTaskDef {
  sub_task_id: string
  description: string
  responsible_user_id: string[]
}

export interface ChecklistSection {
  unit_checklist_id: string
  section_name: string
  prerequisite_item_id: string
  physical_location: string
  phone_number?: string
  sub_tasks: SubTaskDef[]
}

export interface UnitChecklist {
  unit_id: string
  checklist_name: string
  sections: ChecklistSection[]
}

export interface ProgressTask {
  sub_task_id: string
  status: 'Pending' | 'Cleared' | 'Skipped'
  cleared_by_user_id?: string
  cleared_at_timestamp?: string
}

export interface MemberProgress {
  member_user_id: string
  unit_id: string
  official_checkin_timestamp: string
  current_file_sha: string
  progress_tasks: ProgressTask[]
}

export const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to fetch ${path}`)
  return res.json()
}

export const getUserByEdipi = async (edipi: string): Promise<LocalUserProfile | null> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') return sbGetUserByEdipi(edipi)
  const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
  const entry = index.users.find(u => u.edipi === edipi)
  if (!entry) return null
  return fetchJson<LocalUserProfile>(`/${entry.path}`)
}

export const verifyPassword = async (plain: string, hashed: string): Promise<boolean> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') return sbVerifyPassword(plain, hashed)
  return bcrypt.compare(plain, hashed)
}

export const getChecklistByUnit = async (unitId: string): Promise<UnitChecklist> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      const { listSections, listSubTasks } = await import('./supabaseUnitConfigService')
      const sections = await listSections(unitId)
      const subTasks = await listSubTasks(unitId)

      const bySection: Record<number, SubTaskDef[]> = {}
      for (const st of subTasks) {
        if (!bySection[st.section_id]) bySection[st.section_id] = []
        bySection[st.section_id].push({
          sub_task_id: st.sub_task_id,
          description: st.description,
          responsible_user_id: st.responsible_user_ids || [],
        })
      }

      const checklist: UnitChecklist = {
        unit_id: unitId,
        checklist_name: 'Unit Checklist',
        sections: sections.map(sec => ({
          unit_checklist_id: String(sec.id),
          section_name: sec.section_name,
          prerequisite_item_id: sec.prerequisite_item_id || '',
          physical_location: sec.physical_location || '',
          phone_number: sec.phone_number || '',
          sub_tasks: bySection[sec.id] || [],
        })),
      }
      return checklist
    } catch {
      // Fallback to static files if Supabase fails
    }
  }
  const index = await fetchJson<{ units: { unit_id: string; path: string }[] }>(`/data/units/index.json`)
  const match = index.units.find(u => u.unit_id === unitId) || index.units[0]
  return await fetchJson<UnitChecklist>(`/${match.path}`)
}

export const getProgressByMember = async (memberUserId: string): Promise<MemberProgress> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    const data = await sbGetProgressByMember(memberUserId)
    if (data) return data
    // Return empty progress if not found in Supabase
    return {
      member_user_id: memberUserId,
      unit_id: '',
      official_checkin_timestamp: new Date().toISOString(),
      current_file_sha: '',
      progress_tasks: [],
    }
  }
  // Fallback to JSON files for demo mode
  try {
    return await fetchJson<MemberProgress>(`/data/members/progress_${memberUserId}.json`)
  } catch {
    return {
      member_user_id: memberUserId,
      unit_id: '',
      official_checkin_timestamp: new Date().toISOString(),
      current_file_sha: '',
      progress_tasks: [],
    }
  }
}

export const listMembers = async (): Promise<{ member_user_id: string; unit_id: string }[]> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    return await sbListMembers()
  }
  // Fallback to JSON files for demo mode
  const index = await fetchJson<{ members: { member_user_id: string; unit_id: string }[] }>(`/data/members/index.json`)
  return index.members
}

export const listPendingForSectionManager = async (userId: string, unitId: string) => {
  const checklist = await getChecklistByUnit(unitId)
  const responsibleSet = new Set<string>(
    checklist.sections.flatMap(s => s.sub_tasks.filter(st => st.responsible_user_id.includes(userId)).map(st => st.sub_task_id))
  )
  const members = await listMembers()
  const pending: { member_user_id: string; sub_task_id: string }[] = []
  for (const m of members.filter(m => m.unit_id === unitId)) {
    const progress = await getProgressByMember(m.member_user_id)
    for (const t of progress.progress_tasks) {
      if (t.status === 'Pending' && responsibleSet.has(t.sub_task_id)) {
        pending.push({ member_user_id: m.member_user_id, sub_task_id: t.sub_task_id })
      }
    }
  }
  return pending
}

export const listArchivedForUser = async (userId: string, unitId: string) => {
  const members = await listMembers()
  const archived: { member_user_id: string; sub_task_id: string; cleared_at_timestamp?: string }[] = []
  for (const m of members.filter(m => m.unit_id === unitId)) {
    const progress = await getProgressByMember(m.member_user_id)
    for (const t of progress.progress_tasks) {
      if (t.status === 'Cleared' && t.cleared_by_user_id === userId) {
        archived.push({ member_user_id: m.member_user_id, sub_task_id: t.sub_task_id, cleared_at_timestamp: t.cleared_at_timestamp })
      }
    }
  }
  return archived
}
