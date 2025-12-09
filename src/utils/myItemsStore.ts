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

export const listMyItems = (user_id: string, kind?: 'Inbound' | 'Outbound'): MyItem[] => {
  const map = load()
  const list = map[user_id] || []
  return kind ? list.filter(i => i.kind === kind) : list
}

export const createMyItem = (user_id: string, name: string, kind: 'Inbound' | 'Outbound', form_id?: number): void => {
  const map = load()
  const list = map[user_id] || []
  const id = Date.now()
  const item: MyItem = { id, user_id, name, kind, created_at: new Date().toISOString(), form_id }
  map[user_id] = [...list, item]
  save(map)
}
