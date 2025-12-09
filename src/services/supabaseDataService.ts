import { supabase } from './supabaseClient'
import bcrypt from 'bcryptjs'
import { LocalUserProfile, MemberProgress } from './localDataService'

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

