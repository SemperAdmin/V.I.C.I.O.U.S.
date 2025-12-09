export type UnitSubTask = {
  id: number
  unit_id: string
  section_id: number
  sub_task_id: string
  description: string
  responsible_user_ids: string[]
  location?: string
  instructions?: string
  kind?: 'Inbound' | 'Outbound'
}

type UnitTasksData = {
  tasks: UnitSubTask[]
}

const STORAGE_KEY = 'unit_tasks_store'

const loadStore = (): Record<string, UnitTasksData> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const saveStore = (store: Record<string, UnitTasksData>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

const ensureUnit = (store: Record<string, UnitTasksData>, unit_id: string): UnitTasksData => {
  if (!store[unit_id]) store[unit_id] = { tasks: [] }
  return store[unit_id]
}

export const listSubTasks = async (unit_id: string): Promise<UnitSubTask[]> => {
  const store = loadStore()
  const data = ensureUnit(store, unit_id)
  return data.tasks
}

export const createSubTask = async (payload: Omit<UnitSubTask, 'id'>): Promise<void> => {
  const store = loadStore()
  const data = ensureUnit(store, payload.unit_id)
  const id = Date.now()
  data.tasks.push({ id, ...payload })
  saveStore(store)
}

export const deleteSubTask = async (id: number): Promise<void> => {
  const store = loadStore()
  for (const unit_id of Object.keys(store)) {
    const data = store[unit_id]
    const idx = data.tasks.findIndex(t => t.id === id)
    if (idx !== -1) {
      data.tasks.splice(idx, 1)
      saveStore(store)
      return
    }
  }
  throw new Error('Task not found')
}

export const updateSubTask = async (id: number, patch: Partial<UnitSubTask>): Promise<void> => {
  const store = loadStore()
  for (const unit_id of Object.keys(store)) {
    const data = store[unit_id]
    const idx = data.tasks.findIndex(t => t.id === id)
    if (idx !== -1) {
      const current = data.tasks[idx]
      data.tasks[idx] = { ...current, ...patch }
      saveStore(store)
      return
    }
  }
  throw new Error('Task not found')
}
