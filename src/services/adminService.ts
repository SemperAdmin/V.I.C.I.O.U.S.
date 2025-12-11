import { supabase } from './supabaseClient'

const isSupabaseConfigured = () => {
  const use = import.meta.env.VITE_USE_SUPABASE === '1'
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  return !!use && typeof url === 'string' && url.startsWith('https://') && typeof key === 'string' && key.length > 10
}

export const sbListUnitAdmins = async (): Promise<Array<{ unit_key: string; unit_name: string; admin_user_id: string; ruc?: string }>> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('unit_admins')
    .select('unit_key,unit_name,admin_user_id,ruc')
  if (error) throw error
  return (data as any) || []
}

export const sbGetAdminRucs = async (admin_edipi: string): Promise<Array<{ ruc: string }>> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('unit_admins')
    .select('ruc')
    .eq('admin_user_id', admin_edipi)
  if (error) throw error
  const rows = (data as any) || []
  // Get unique RUCs
  const uniqueRucs = Array.from(new Set(rows.map((row: any) => row.ruc).filter(Boolean)))
  return uniqueRucs.map(ruc => ({ ruc: String(ruc) }))
}

export const sbGetAdminAssignments = async (admin_edipi: string, ruc: string): Promise<string[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('unit_admin_assignments')
    .select('unit_id')
    .eq('admin_edipi', admin_edipi)
    .eq('ruc', ruc)
  if (error) throw error
  return (data || []).map((d: any) => d.unit_id)
}

export const sbSetAdminAssignments = async (admin_edipi: string, ruc: string, unit_ids: string[]): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error: delErr } = await supabase
    .from('unit_admin_assignments')
    .delete()
    .eq('admin_edipi', admin_edipi)
    .eq('ruc', ruc)
    .not('unit_id', 'in', unit_ids.length ? `(${unit_ids.join(',')})` : '(NULL)')
  if (delErr) throw delErr
  const rows = unit_ids.map(id => ({ admin_edipi, ruc, unit_id: id }))
  if (rows.length) {
    const { error: upErr } = await supabase
      .from('unit_admin_assignments')
      .upsert(rows, { onConflict: 'admin_edipi,unit_id' })
    if (upErr) throw upErr
  }
}

export const sbUpsertUnitAdmin = async (unit_key: string, unit_name: string, admin_user_id: string, ruc?: string): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase
    .from('unit_admins')
    .upsert({ unit_key, unit_name, admin_user_id, ruc }, { onConflict: 'unit_key,admin_user_id' })
  if (error) throw error
}

export const sbRemoveUnitAdmin = async (unit_key: string, admin_user_id: string): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase
    .from('unit_admins')
    .delete()
    .eq('unit_key', unit_key)
    .eq('admin_user_id', admin_user_id)
  if (error) throw error
}

export const sbPromoteUserToUnitAdmin = async (edipi: string, unit_key: string): Promise<void> => {
  if (!isSupabaseConfigured()) return
  // Best-effort role promotion if a users table exists
  try {
    const { error } = await supabase
      .from('users')
      .update({ org_role: 'Unit_Admin' })
      .eq('edipi', edipi)
    if (error) throw error
  } catch {
    // silently ignore if schema differs in local/dev
  }
}
