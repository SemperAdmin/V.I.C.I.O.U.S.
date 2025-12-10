import { supabase } from './supabaseClient'

export type UnitSection = {
  id: number
  unit_id: string
  section_name: string
  company_id?: string
  display_name?: string
  prerequisite_item_id?: string
  physical_location?: string
  phone_number?: string
}

export type UnitSubTask = {
  id: number
  unit_id: string
  section_id: number
  sub_task_id: string
  description: string
  responsible_user_ids: string[]
  location?: string
  instructions?: string
  completion_kind?: 'Text' | 'Date' | 'Options'
  completion_label?: string
  completion_options?: string[]
}

export type UnitCompany = {
  id: number
  unit_id: string
  company_id: string
  display_name?: string
}

export const listSections = async (unit_id: string): Promise<UnitSection[]> => {
  const tryEq = async (val: string) => supabase.from('unit_sections').select('*').eq('unit_id', val).order('section_name')
  const ruc = (unit_id || '').includes('-') ? (unit_id || '').split('-')[1] : unit_id
  let { data, error } = await tryEq(unit_id)
  if (error) throw error
  let rows = (data as any) || []
  if (!rows.length && ruc) {
    const r = await tryEq(ruc)
    if (r.error) throw r.error
    rows = (rows as any).concat(r.data || [])
    if (!rows.length) {
      const like = await supabase.from('unit_sections').select('*').ilike('unit_id', `%-${ruc}-%`).order('section_name')
      if (like.error) throw like.error
      rows = (rows as any).concat(like.data || [])
    }
  }
  const dedup = Array.from(new Map((rows as any[]).map(s => [s.id, s])).values())
  return dedup as any
}

export const createSection = async (unit_id: string, section_name: string, extra: Partial<UnitSection> = {}): Promise<void> => {
  const { error } = await supabase.from('unit_sections').insert({ unit_id, section_name, ...extra })
  if (error) throw error
}

export const deleteSection = async (id: number): Promise<void> => {
  const { error } = await supabase.from('unit_sections').delete().eq('id', id)
  if (error) throw error
}

export const updateSection = async (id: number, patch: Partial<UnitSection>): Promise<void> => {
  const allowed: Partial<UnitSection> = {
    company_id: patch.company_id,
    section_name: patch.section_name,
    display_name: patch.display_name,
    prerequisite_item_id: patch.prerequisite_item_id,
    physical_location: patch.physical_location,
    phone_number: patch.phone_number,
  }
  const { error } = await supabase.from('unit_sections').update(allowed as any).eq('id', id)
  if (error) throw error
}

export const listSubTasks = async (unit_id: string): Promise<UnitSubTask[]> => {
  const tryEq = async (val: string) => supabase.from('unit_sub_tasks').select('*').eq('unit_id', val).order('sub_task_id')
  const ruc = (unit_id || '').includes('-') ? (unit_id || '').split('-')[1] : unit_id
  let { data, error } = await tryEq(unit_id)
  if (error) throw error
  let rows = (data as any) || []
  if (!rows.length && ruc) {
    const r = await tryEq(ruc)
    if (r.error) throw r.error
    rows = (rows as any).concat(r.data || [])
    if (!rows.length) {
      const like = await supabase.from('unit_sub_tasks').select('*').ilike('unit_id', `%-${ruc}-%`).order('sub_task_id')
      if (like.error) throw like.error
      rows = (rows as any).concat(like.data || [])
    }
  }
  const dedup = Array.from(new Map((rows as any[]).map(t => [t.id, t])).values())
  return dedup as any
}

export const createSubTask = async (payload: Omit<UnitSubTask, 'id'>): Promise<void> => {
  const { error } = await supabase.from('unit_sub_tasks').insert(payload as any)
  if (error) throw error
}

export const deleteSubTask = async (id: number): Promise<void> => {
  const { error } = await supabase.from('unit_sub_tasks').delete().eq('id', id)
  if (error) throw error
}

export const updateSubTask = async (id: number, patch: Partial<UnitSubTask>): Promise<void> => {
  const allowed = {
    description: patch.description,
    location: patch.location,
    instructions: patch.instructions,
    responsible_user_ids: patch.responsible_user_ids,
    sub_task_id: patch.sub_task_id,
    completion_kind: patch.completion_kind,
    completion_label: patch.completion_label,
    completion_options: patch.completion_options,
  }
  const { error } = await supabase.from('unit_sub_tasks').update(allowed as any).eq('id', id)
  if (error) throw error
}

export const listCompanies = async (unit_id: string): Promise<UnitCompany[]> => {
  const tryEq = async (val: string) => supabase.from('unit_companies').select('*').eq('unit_id', val).order('company_id')
  const ruc = (unit_id || '').includes('-') ? (unit_id || '').split('-')[1] : unit_id
  let { data, error } = await tryEq(unit_id)
  if (error) throw error
  let rows = (data as any) || []
  if (!rows.length && ruc) {
    const r = await tryEq(ruc)
    if (r.error) throw r.error
    rows = (rows as any).concat(r.data || [])
    if (!rows.length) {
      const like = await supabase.from('unit_companies').select('*').ilike('unit_id', `%-${ruc}-%`).order('company_id')
      if (like.error) throw like.error
      rows = (rows as any).concat(like.data || [])
    }
  }
  const dedup = Array.from(new Map((rows as any[]).map(c => [c.id, c])).values())
  return dedup as any
}

export const createCompany = async (unit_id: string, company_id: string, display_name?: string): Promise<void> => {
  const { error } = await supabase.from('unit_companies').insert({ unit_id, company_id, display_name })
  if (error) throw error
}

export const deleteCompany = async (id: number): Promise<void> => {
  const { error } = await supabase.from('unit_companies').delete().eq('id', id)
  if (error) throw error
}
