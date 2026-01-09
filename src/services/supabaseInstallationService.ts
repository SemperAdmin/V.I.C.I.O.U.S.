import { supabase } from './supabaseClient'
import type { Installation, InstallationSection, InstallationSubTask } from '../types'

// =====================================================
// Installation CRUD Operations
// =====================================================

export const listInstallations = async (): Promise<Installation[]> => {
  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .order('name')
  if (error) throw error
  return (data as Installation[]) || []
}

export const getInstallation = async (id: string): Promise<Installation | null> => {
  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as Installation | null
}

export const createInstallation = async (installation: Omit<Installation, 'created_at' | 'updated_at'>): Promise<void> => {
  const { error } = await supabase.from('installations').insert(installation)
  if (error) throw error
}

export const updateInstallation = async (id: string, patch: Partial<Installation>): Promise<void> => {
  const allowed = {
    name: patch.name,
    acronym: patch.acronym,
    location: patch.location,
    base_type: patch.base_type,
    command: patch.command,
    unit_ids: patch.unit_ids,
    sections: patch.sections,
    section_assignments: patch.section_assignments,
    commander_user_id: patch.commander_user_id,
    insta_admin_user_ids: patch.insta_admin_user_ids,
  }
  const { error } = await supabase.from('installations').update(allowed as any).eq('id', id)
  if (error) throw error
}

export const deleteInstallation = async (id: string): Promise<void> => {
  const { error } = await supabase.from('installations').delete().eq('id', id)
  if (error) throw error
}

// Get installation by user (for Insta Admins or civilians assigned to installation)
export const getInstallationByUserId = async (userId: string): Promise<Installation | null> => {
  // First check if user is an insta admin
  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .contains('insta_admin_user_ids', [userId])
  if (error) throw error
  if (data && data.length > 0) return data[0] as Installation
  return null
}

// Get installation for a unit
export const getInstallationForUnit = async (unitId: string): Promise<Installation | null> => {
  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .contains('unit_ids', [unitId])
  if (error) throw error
  if (data && data.length > 0) return data[0] as Installation
  return null
}

// Assign units to an installation
export const assignUnitsToInstallation = async (installationId: string, unitIds: string[]): Promise<void> => {
  const { error } = await supabase
    .from('installations')
    .update({ unit_ids: unitIds })
    .eq('id', installationId)
  if (error) throw error
}

// Add Insta Admin to installation
export const addInstaAdmin = async (installationId: string, userId: string): Promise<void> => {
  const installation = await getInstallation(installationId)
  if (!installation) throw new Error('Installation not found')
  const adminIds = installation.insta_admin_user_ids || []
  if (!adminIds.includes(userId)) {
    adminIds.push(userId)
    await updateInstallation(installationId, { insta_admin_user_ids: adminIds })
  }
}

// Remove Insta Admin from installation
export const removeInstaAdmin = async (installationId: string, userId: string): Promise<void> => {
  const installation = await getInstallation(installationId)
  if (!installation) throw new Error('Installation not found')
  const adminIds = (installation.insta_admin_user_ids || []).filter(id => id !== userId)
  await updateInstallation(installationId, { insta_admin_user_ids: adminIds })
}

// =====================================================
// Installation Section CRUD Operations
// =====================================================

export const listInstallationSections = async (installationId: string): Promise<InstallationSection[]> => {
  const { data, error } = await supabase
    .from('installation_sections')
    .select('*')
    .eq('installation_id', installationId)
    .order('section_name')
  if (error) throw error
  return (data as InstallationSection[]) || []
}

export const createInstallationSection = async (
  installationId: string,
  sectionName: string,
  extra: Partial<InstallationSection> = {}
): Promise<void> => {
  const { error } = await supabase
    .from('installation_sections')
    .insert({ installation_id: installationId, section_name: sectionName, ...extra })
  if (error) throw error
}

export const updateInstallationSection = async (id: number, patch: Partial<InstallationSection>): Promise<void> => {
  const allowed = {
    section_name: patch.section_name,
    display_name: patch.display_name,
    physical_location: patch.physical_location,
    phone_number: patch.phone_number,
  }
  const { error } = await supabase.from('installation_sections').update(allowed as any).eq('id', id)
  if (error) throw error
}

export const deleteInstallationSection = async (id: number): Promise<void> => {
  const { error } = await supabase.from('installation_sections').delete().eq('id', id)
  if (error) throw error
}

// =====================================================
// Installation Sub-Task CRUD Operations
// =====================================================

export const listInstallationSubTasks = async (installationId: string): Promise<InstallationSubTask[]> => {
  const { data, error } = await supabase
    .from('installation_sub_tasks')
    .select('*')
    .eq('installation_id', installationId)
    .order('sub_task_id')
  if (error) throw error
  return (data as InstallationSubTask[]) || []
}

export const listInstallationSubTasksBySection = async (sectionId: number): Promise<InstallationSubTask[]> => {
  const { data, error } = await supabase
    .from('installation_sub_tasks')
    .select('*')
    .eq('section_id', sectionId)
    .order('sub_task_id')
  if (error) throw error
  return (data as InstallationSubTask[]) || []
}

export const createInstallationSubTask = async (payload: Omit<InstallationSubTask, 'id' | 'created_at'>): Promise<void> => {
  const { error } = await supabase.from('installation_sub_tasks').insert(payload as any)
  if (error) throw error
}

export const updateInstallationSubTask = async (id: number, patch: Partial<InstallationSubTask>): Promise<void> => {
  const allowed = {
    sub_task_id: patch.sub_task_id,
    description: patch.description,
    responsible_user_ids: patch.responsible_user_ids,
    location: patch.location,
    map_url: patch.map_url,
    instructions: patch.instructions,
    completion_kind: patch.completion_kind,
    completion_label: patch.completion_label,
    completion_options: patch.completion_options,
  }
  const { error } = await supabase.from('installation_sub_tasks').update(allowed as any).eq('id', id)
  if (error) throw error
}

export const deleteInstallationSubTask = async (id: number): Promise<void> => {
  const { error } = await supabase.from('installation_sub_tasks').delete().eq('id', id)
  if (error) throw error
}

// =====================================================
// Helper: Get inherited tasks for a unit
// =====================================================

export const getInheritedTasksForUnit = async (unitId: string): Promise<InstallationSubTask[]> => {
  const installation = await getInstallationForUnit(unitId)
  if (!installation) return []
  return listInstallationSubTasks(installation.id)
}

export const getInheritedSectionsForUnit = async (unitId: string): Promise<InstallationSection[]> => {
  const installation = await getInstallationForUnit(unitId)
  if (!installation) return []
  return listInstallationSections(installation.id)
}
