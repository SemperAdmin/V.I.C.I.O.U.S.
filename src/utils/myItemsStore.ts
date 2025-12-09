import { sbListMyItems, sbCreateMyItem, sbDeleteMyItem } from '@/services/supabaseDataService'

export type MyItem = {
  id: number
  user_id: string
  name: string
  kind: 'Inbound' | 'Outbound'
  created_at: string
  form_id?: number
}

const KEY = 'my_items_store'

const load = (): Record<string, MyItem[]> => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: Record<string, MyItem[]>) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

// LocalStorage fallback functions
const localListMyItems = (user_id: string, kind?: 'Inbound' | 'Outbound'): MyItem[] => {
  const map = load()
  const list = map[user_id] || []
  return kind ? list.filter(i => i.kind === kind) : list
}

const localCreateMyItem = (user_id: string, name: string, kind: 'Inbound' | 'Outbound', form_id?: number): MyItem => {
  const map = load()
  const list = map[user_id] || []
  const id = Date.now()
  const item: MyItem = { id, user_id, name, kind, created_at: new Date().toISOString(), form_id }
  map[user_id] = [...list, item]
  save(map)
  return item
}

const localDeleteMyItem = (user_id: string, id: number): void => {
  const map = load()
  const list = map[user_id] || []
  map[user_id] = list.filter(i => i.id !== id)
  save(map)
}

// Public API - Uses Supabase with localStorage fallback
export const listMyItems = async (user_id: string, kind?: 'Inbound' | 'Outbound'): Promise<MyItem[]> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      return await sbListMyItems(user_id, kind)
    } catch (err) {
      console.warn('Supabase listMyItems failed, using localStorage fallback:', err)
      return localListMyItems(user_id, kind)
    }
  }
  return localListMyItems(user_id, kind)
}

export const createMyItem = async (user_id: string, name: string, kind: 'Inbound' | 'Outbound', form_id?: number): Promise<void> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      await sbCreateMyItem({ user_id, name, kind, form_id })
      return
    } catch (err) {
      console.warn('Supabase createMyItem failed, using localStorage fallback:', err)
    }
  }
  localCreateMyItem(user_id, name, kind, form_id)
}

export const deleteMyItem = async (user_id: string, id: number): Promise<void> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    try {
      await sbDeleteMyItem(id)
      return
    } catch (err) {
      console.warn('Supabase deleteMyItem failed, using localStorage fallback:', err)
    }
  }
  localDeleteMyItem(user_id, id)
}
