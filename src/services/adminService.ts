import { supabase } from './supabaseClient'

export const sbListUnitAdmins = async (): Promise<Array<{ unit_key: string; unit_name: string; admin_user_id: string }>> => {
  const { data, error } = await supabase.from('unit_admins').select('*').order('unit_name')
  if (error) throw error
  return data || []
}

export const sbUpsertUnitAdmin = async (unit_key: string, unit_name: string, admin_user_id: string): Promise<void> => {
  const { error } = await supabase.from('unit_admins').upsert({ unit_key, unit_name, admin_user_id })
  if (error) throw error
}

export const sbRemoveUnitAdmin = async (unit_key: string): Promise<void> => {
  const { error } = await supabase.from('unit_admins').delete().eq('unit_key', unit_key)
  if (error) throw error
}

export const sbPromoteUserToUnitAdmin = async (edipi: string, unit_key: string): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ org_role: 'Unit_Admin', unit_id: unit_key })
    .eq('edipi', edipi)
  if (error) throw error
}
