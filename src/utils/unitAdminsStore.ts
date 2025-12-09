type UnitAdminsMap = Record<string, string[]>

const KEY = 'unit_admins_map'

const load = (): UnitAdminsMap => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: UnitAdminsMap) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export const getUnitAdmins = (unit_key: string): string[] => {
  const map = load()
  return map[unit_key] || []
}

export const setUnitAdmins = (unit_key: string, edipis: string[]) => {
  const map = load()
  map[unit_key] = Array.from(new Set(edipis.filter(Boolean)))
  save(map)
}

export const addUnitAdmin = (unit_key: string, edipi: string) => {
  const map = load()
  const list = new Set(map[unit_key] || [])
  if (edipi) list.add(edipi)
  map[unit_key] = Array.from(list)
  save(map)
}

export const removeUnitAdmin = (unit_key: string, edipi: string) => {
  const map = load()
  const list = (map[unit_key] || []).filter(x => x !== edipi)
  map[unit_key] = list
  save(map)
}

