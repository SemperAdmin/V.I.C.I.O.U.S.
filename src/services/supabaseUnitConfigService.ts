import { supabase } from './supabaseClient'

export type UnitSection = {
  id: number
  unit_id: string
  section_name: string
  company_id?: string
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
}

export type UnitCompany = {
  id: number
  unit_id: string
  company_id: string
  display_name?: string
}

export const listSections = async (unit_id: string): Promise<UnitSection[]> => {
  const { data, error } = await supabase.from('unit_sections').select('*').eq('unit_id', unit_id).order('section_name')
  if (error) throw error
  return (data as any) || []
}

export const createSection = async (unit_id: string, section_name: string, extra: Partial<UnitSection> = {}): Promise<void> => {
  const { error } = await supabase.from('unit_sections').insert({ unit_id, section_name, ...extra })
  if (error) throw error
}

export const deleteSection = async (id: number): Promise<void> => {
  const { error } = await supabase.from('unit_sections').delete().eq('id', id)
  if (error) throw error
}

export const listSubTasks = async (unit_id: string): Promise<UnitSubTask[]> => {
  const { data, error } = await supabase.from('unit_sub_tasks').select('*').eq('unit_id', unit_id).order('sub_task_id')
  if (error) throw error
  return (data as any) || []
}

export const createSubTask = async (payload: Omit<UnitSubTask, 'id'>): Promise<void> => {
  const { error } = await supabase.from('unit_sub_tasks').insert(payload as any)
  if (error) throw error
}

export const deleteSubTask = async (id: number): Promise<void> => {
  const { error } = await supabase.from('unit_sub_tasks').delete().eq('id', id)
  if (error) throw error
}

export const listCompanies = async (unit_id: string): Promise<UnitCompany[]> => {
  const { data, error } = await supabase.from('unit_companies').select('*').eq('unit_id', unit_id).order('company_id')
  if (error) throw error
  return (data as any) || []
}

export const createCompany = async (unit_id: string, company_id: string, display_name?: string): Promise<void> => {
  const { error } = await supabase.from('unit_companies').insert({ unit_id, company_id, display_name })
  if (error) throw error
}

export const deleteCompany = async (id: number): Promise<void> => {
  const { error } = await supabase.from('unit_companies').delete().eq('id', id)
  if (error) throw error
}
