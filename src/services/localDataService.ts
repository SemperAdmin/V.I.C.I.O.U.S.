import bcrypt from 'bcryptjs'
import { sbGetUserByEdipi, sbVerifyPassword } from './supabaseDataService'

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
  return fetchJson<UnitChecklist>(`/data/units/${unitId}/checklist.json`)
}

export const getProgressByMember = async (memberUserId: string): Promise<MemberProgress> => {
  return fetchJson<MemberProgress>(`/data/members/progress_${memberUserId}.json`)
}

export const listMembers = async (): Promise<{ member_user_id: string; unit_id: string }[]> => {
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
