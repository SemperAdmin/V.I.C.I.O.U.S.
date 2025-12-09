import { sbListSubmissions, sbCreateSubmission, sbDeleteSubmission } from '@/services/supabaseDataService'

export type MyFormSubmissionTask = {
  sub_task_id: string
  description: string
  status: 'Pending' | 'Cleared' | 'Skipped'
}

export type MyFormSubmission = {
  id: number
  user_id: string
  unit_id: string
  form_id: number
  form_name: string
  kind: 'Inbound' | 'Outbound'
  created_at: string
  member: {
    edipi: string
    rank?: string
    first_name?: string
    last_name?: string
    company_id?: string
    platoon_id?: string
  }
  tasks: MyFormSubmissionTask[]
}

const KEY = 'my_form_submissions'

const load = (): Record<string, MyFormSubmission[]> => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: Record<string, MyFormSubmission[]>) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

// LocalStorage fallback functions
const localListSubmissions = (user_id: string): MyFormSubmission[] => {
  const map = load()
  return map[user_id] || []
}

const localCreateSubmission = (submission: Omit<MyFormSubmission, 'id' | 'created_at'>): MyFormSubmission => {
  const map = load()
  const id = Date.now()
  const full: MyFormSubmission = { ...submission, id, created_at: new Date().toISOString() }
  const list = map[submission.user_id] || []
  map[submission.user_id] = [...list, full]
  save(map)
  return full
}

const localDeleteSubmission = (user_id: string, id: number): void => {
  const map = load()
  const list = map[user_id] || []
  map[user_id] = list.filter(s => s.id !== id)
  save(map)
}

// Public API - Uses Supabase with localStorage fallback
export const listSubmissions = async (user_id: string): Promise<MyFormSubmission[]> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      return await sbListSubmissions(user_id)
    } catch (err) {
      console.warn('Supabase listSubmissions failed, using localStorage fallback:', err)
      return localListSubmissions(user_id)
    }
  }
  return localListSubmissions(user_id)
}

export const createSubmission = async (submission: Omit<MyFormSubmission, 'id' | 'created_at'>): Promise<MyFormSubmission> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      return await sbCreateSubmission(submission)
    } catch (err) {
      console.warn('Supabase createSubmission failed, using localStorage fallback:', err)
      return localCreateSubmission(submission)
    }
  }
  return localCreateSubmission(submission)
}

export const deleteSubmission = async (user_id: string, id: number): Promise<void> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      await sbDeleteSubmission(id)
      return
    } catch (err) {
      console.warn('Supabase deleteSubmission failed, using localStorage fallback:', err)
    }
  }
  localDeleteSubmission(user_id, id)
}
