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
  // Get unique RUCs using modern spread syntax
  const uniqueRucs = [...new Set(rows.map((row: { ruc: string | null }) => row.ruc).filter(Boolean) as string[])]
  return uniqueRucs.map(ruc => ({ ruc }))
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

// ===== Sponsorship Coordinator Management =====

export type SponsorshipCoordinator = {
  id?: number
  coordinator_edipi: string
  ruc: string
  created_at?: string
}

export const sbListSponsorshipCoordinators = async (): Promise<SponsorshipCoordinator[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('sponsorship_coordinators')
    .select('*')
  if (error) {
    // Table might not exist yet, return empty
    console.warn('sponsorship_coordinators table not found:', error.message)
    return []
  }
  return (data as any) || []
}

export const sbListSponsorshipCoordinatorsByRuc = async (ruc: string): Promise<SponsorshipCoordinator[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('sponsorship_coordinators')
    .select('*')
    .eq('ruc', ruc)
  if (error) {
    console.warn('sponsorship_coordinators table not found:', error.message)
    return []
  }
  return (data as any) || []
}

export const sbGetCoordinatorRucs = async (coordinator_edipi: string): Promise<string[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('sponsorship_coordinators')
    .select('ruc')
    .eq('coordinator_edipi', coordinator_edipi)
  if (error) {
    console.warn('sponsorship_coordinators table not found:', error.message)
    return []
  }
  const rows = (data as any) || []
  const rucs = rows.map((row: { ruc: string }) => row.ruc).filter(Boolean) as string[]
  return [...new Set(rucs)]
}

export const sbUpsertSponsorshipCoordinator = async (coordinator_edipi: string, ruc: string): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase
    .from('sponsorship_coordinators')
    .upsert({ coordinator_edipi, ruc }, { onConflict: 'coordinator_edipi,ruc' })
  if (error) throw error
}

export const sbRemoveSponsorshipCoordinator = async (coordinator_edipi: string, ruc: string): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase
    .from('sponsorship_coordinators')
    .delete()
    .eq('coordinator_edipi', coordinator_edipi)
    .eq('ruc', ruc)
  if (error) throw error
}

// ===== Sponsor Assignment for Form Submissions =====

export const sbAssignSponsor = async (submission_id: number, sponsor_edipi: string, sponsor_name: string): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase
    .from('my_form_submissions')
    .update({
      assigned_sponsor_edipi: sponsor_edipi,
      assigned_sponsor_name: sponsor_name
    })
    .eq('id', submission_id)
  if (error) throw error
}

export const sbRemoveSponsorAssignment = async (submission_id: number): Promise<void> => {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase
    .from('my_form_submissions')
    .update({
      assigned_sponsor_edipi: null,
      assigned_sponsor_name: null
    })
    .eq('id', submission_id)
  if (error) throw error
}

// Get outbound submissions for units within a specific RUC (for Sponsorship Coordinator dashboard)
// Uses database-side filtering with LIKE pattern for efficiency
export const sbListOutboundSubmissionsByDestinationRuc = async (ruc: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return []

  // Use database-side filtering with LIKE pattern to match RUC in destination_unit_id
  // Format is typically: UIC-RUC-MCC (e.g., M00318-02301-091)
  const rucPattern = `%-${ruc}-%`

  const { data, error } = await supabase
    .from('my_form_submissions')
    .select('*')
    .eq('kind', 'Outbound')
    .or(`destination_unit_id.like.${rucPattern},destination_unit_id.eq.${ruc}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get submissions where the user is assigned as sponsor (for sponsor's view of their sponsees)
export const sbListSubmissionsBySponsor = async (sponsor_edipi: string): Promise<any[]> => {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('my_form_submissions')
    .select('*')
    .eq('assigned_sponsor_edipi', sponsor_edipi)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}
