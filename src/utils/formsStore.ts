import { sbListForms, sbCreateForm, sbUpdateForm, sbDeleteForm } from '@/services/supabaseDataService'

export type UnitFormPurpose =
  | 'Fleet_Assistance_Program'
  | 'TAD_31_plus_days'
  | 'TAD_30_or_less'
  | 'PCA'
  | 'PCS'
  | 'Separation'
  | 'Retirement'

export type UnitForm = {
  id: number
  unit_id: string
  name: string
  kind: 'Inbound' | 'Outbound'
  task_ids: string[]
  purpose?: UnitFormPurpose
}

const KEY = 'unit_forms_store'

const load = (): Record<string, UnitForm[]> => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: Record<string, UnitForm[]>) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

// LocalStorage fallback functions
const localListForms = (unit_id: string): UnitForm[] => {
  const map = load()
  return map[unit_id] || []
}

const localCreateForm = (unit_id: string, name: string, kind: 'Inbound' | 'Outbound', task_ids: string[], purpose?: UnitFormPurpose): UnitForm => {
  const map = load()
  const list = map[unit_id] || []
  if (list.find(f => f.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Form name must be unique')
  }
  const id = Date.now()
  const form: UnitForm = { id, unit_id, name, kind, task_ids, purpose }
  map[unit_id] = [...list, form]
  save(map)
  return form
}

const localDeleteForm = (unit_id: string, id: number): void => {
  const map = load()
  const list = map[unit_id] || []
  map[unit_id] = list.filter(f => f.id !== id)
  save(map)
}

const localUpdateForm = (unit_id: string, id: number, patch: Partial<UnitForm>): void => {
  const map = load()
  const list = map[unit_id] || []
  const idx = list.findIndex(f => f.id === id)
  if (idx === -1) return
  const next = { ...list[idx], ...patch }
  if (patch.name) {
    const dup = list.find(f => f.id !== id && f.name.toLowerCase() === patch.name!.toLowerCase())
    if (dup) throw new Error('Form name must be unique')
  }
  list[idx] = next
  map[unit_id] = list
  save(map)
}

// Public API - Uses Supabase with localStorage fallback
export const listForms = async (unit_id: string): Promise<UnitForm[]> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      return await sbListForms(unit_id)
    } catch (err) {
      console.warn('Supabase listForms failed, using localStorage fallback:', err)
      return localListForms(unit_id)
    }
  }
  return localListForms(unit_id)
}

export const createForm = async (unit_id: string, name: string, kind: 'Inbound' | 'Outbound', task_ids: string[], purpose?: UnitFormPurpose): Promise<void> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      await sbCreateForm({ unit_id, name, kind, task_ids, purpose })
      return
    } catch (err) {
      console.warn('Supabase createForm failed, using localStorage fallback:', err)
    }
  }
  localCreateForm(unit_id, name, kind, task_ids, purpose)
}

export const deleteForm = async (unit_id: string, id: number): Promise<void> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      await sbDeleteForm(id)
      return
    } catch (err) {
      console.warn('Supabase deleteForm failed, using localStorage fallback:', err)
    }
  }
  localDeleteForm(unit_id, id)
}

export const updateForm = async (unit_id: string, id: number, patch: Partial<UnitForm>): Promise<void> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      await sbUpdateForm(id, patch)
      return
    } catch (err) {
      console.warn('Supabase updateForm failed, using localStorage fallback:', err)
    }
  }
  localUpdateForm(unit_id, id, patch)
}
