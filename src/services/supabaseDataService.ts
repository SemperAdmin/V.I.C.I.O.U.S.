import { supabase } from './supabaseClient'
import bcrypt from 'bcryptjs'
import { LocalUserProfile, MemberProgress } from './localDataService'
import type { UnitForm } from '@/utils/formsStore'
import type { MyItem } from '@/utils/myItemsStore'
import type { MyFormSubmission } from '@/utils/myFormSubmissionsStore'

export const sbGetUserByEdipi = async (edipi: string): Promise<LocalUserProfile | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('edipi', edipi)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as any) || null
}

export const sbVerifyPassword = async (plain: string, hashed: string): Promise<boolean> => {
  return bcrypt.compare(plain, hashed)
}

export const sbInsertUser = async (user: LocalUserProfile): Promise<void> => {
  const { error } = await supabase.from('users').insert(user as any)
  if (error) throw error
}

export const sbUpsertProgress = async (progress: MemberProgress): Promise<void> => {
  const { error } = await supabase.from('members_progress').upsert(progress as any)
  if (error) throw error
}

export const sbGetProgressByMember = async (memberUserId: string): Promise<MemberProgress | null> => {
  const { data, error } = await supabase
    .from('members_progress')
    .select('*')
    .eq('member_user_id', memberUserId)
    .maybeSingle()
  if (error) throw error
  return (data as any) || null
}

export const sbListMembers = async (): Promise<{ member_user_id: string; unit_id: string }[]> => {
  const { data, error } = await supabase
    .from('members_progress')
    .select('member_user_id, unit_id')
  if (error) throw error
  return (data as any) || []
}

// ===== Forms Management =====

export const sbListForms = async (unit_id: string): Promise<UnitForm[]> => {
  const { data, error } = await supabase
    .from('unit_forms')
    .select('*')
    .eq('unit_id', unit_id)
    .order('name')
  if (error) throw error
  return (data as any) || []
}

export const sbCreateForm = async (form: Omit<UnitForm, 'id' | 'created_at' | 'updated_at'>): Promise<UnitForm> => {
  const { data, error } = await supabase
    .from('unit_forms')
    .insert(form as any)
    .select()
    .single()
  if (error) throw error
  return data as any
}

export const sbUpdateForm = async (id: number, patch: Partial<UnitForm>): Promise<void> => {
  const { error } = await supabase
    .from('unit_forms')
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
  if (error) throw error
}

export const sbDeleteForm = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('unit_forms')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ===== My Items Management =====

export const sbListMyItems = async (user_id: string, kind?: 'Inbound' | 'Outbound'): Promise<MyItem[]> => {
  let query = supabase
    .from('my_items')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (kind) {
    query = query.eq('kind', kind)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as any) || []
}

export const sbCreateMyItem = async (item: Omit<MyItem, 'id' | 'created_at'>): Promise<MyItem> => {
  const { data, error } = await supabase
    .from('my_items')
    .insert(item as any)
    .select()
    .single()
  if (error) throw error
  return data as any
}

export const sbDeleteMyItem = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('my_items')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ===== Form Submissions Management =====

export const sbListSubmissions = async (user_id: string): Promise<MyFormSubmission[]> => {
  const { data, error } = await supabase
    .from('my_form_submissions')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as any) || []
}

export const sbCreateSubmission = async (submission: Omit<MyFormSubmission, 'id' | 'created_at'>): Promise<MyFormSubmission> => {
  const { data, error } = await supabase
    .from('my_form_submissions')
    .insert(submission as any)
    .select()
    .single()
  if (error) throw error
  return data as any
}

export const sbDeleteSubmission = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('my_form_submissions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

