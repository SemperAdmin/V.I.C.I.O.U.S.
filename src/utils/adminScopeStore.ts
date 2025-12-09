type AdminScope = {
  edipi: string
  ruc: string
  unit_ids: string[]
}

const KEY = 'admin_scope_assignments'

const load = (): Record<string, AdminScope> => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: Record<string, AdminScope>) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export const getAssignedUnitsForRuc = (edipi: string, ruc: string): string[] => {
  const map = load()
  const key = `${edipi}|${ruc}`
  return map[key]?.unit_ids || []
}

export const setAssignedUnitsForRuc = (edipi: string, ruc: string, unit_ids: string[]) => {
  const map = load()
  const key = `${edipi}|${ruc}`
  map[key] = { edipi, ruc, unit_ids }
  save(map)
}
