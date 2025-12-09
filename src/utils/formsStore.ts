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

export const listForms = (unit_id: string): UnitForm[] => {
  const map = load()
  return map[unit_id] || []
}

export const createForm = (unit_id: string, name: string, kind: 'Inbound' | 'Outbound', task_ids: string[], purpose?: UnitFormPurpose): void => {
  const map = load()
  const list = map[unit_id] || []
  if (list.find(f => f.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Form name must be unique')
  }
  const id = Date.now()
  const form: UnitForm = { id, unit_id, name, kind, task_ids, purpose }
  map[unit_id] = [...list, form]
  save(map)
}

export const deleteForm = (unit_id: string, id: number): void => {
  const map = load()
  const list = map[unit_id] || []
  map[unit_id] = list.filter(f => f.id !== id)
  save(map)
}

export const updateForm = (unit_id: string, id: number, patch: Partial<UnitForm>): void => {
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
