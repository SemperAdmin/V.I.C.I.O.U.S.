export type UnitCompany = {
  id: number
  unit_id: string
  company_id: string
  display_name?: string
}

export type UnitSection = {
  id: number
  unit_id: string
  section_name: string
  company_id?: string
  display_name?: string
  prerequisite_item_id?: string
  physical_location?: string
  phone_number?: string
}

type UnitStructureData = {
  companies: UnitCompany[]
  sections: UnitSection[]
}

const STORAGE_KEY = 'unit_structure_store'

const loadStore = (): Record<string, UnitStructureData> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const saveStore = (store: Record<string, UnitStructureData>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

const ensureUnit = (store: Record<string, UnitStructureData>, unit_id: string): UnitStructureData => {
  if (!store[unit_id]) store[unit_id] = { companies: [], sections: [] }
  return store[unit_id]
}

export const listCompanies = async (unit_id: string): Promise<UnitCompany[]> => {
  const fromFile = await loadUnitStructureFromFiles(unit_id)
  const store = loadStore()
  const data = ensureUnit(store, unit_id)
  const fileCompanies: UnitCompany[] = Array.isArray(fromFile?.companies)
    ? fromFile.companies.map((c: any, i: number) => ({
        id: i + 1,
        unit_id,
        company_id: c.id || c.code || c.name,
        display_name: c.name || c.title || c.id || undefined,
      }))
    : []
  const all = [...fileCompanies, ...data.companies]
  const dedup = Array.from(new Map(all.map(c => [c.company_id, c])).values())
  return dedup
}

export const createCompany = async (unit_id: string, company_id: string, display_name?: string): Promise<void> => {
  const store = loadStore()
  const data = ensureUnit(store, unit_id)
  if (data.companies.some(c => c.company_id === company_id)) {
    return
  }
  const id = Date.now()
  data.companies.push({ id, unit_id, company_id, display_name })
  saveStore(store)
}

export const deleteCompany = async (unit_company_id: number): Promise<void> => {
  const store = loadStore()
  for (const unit_id of Object.keys(store)) {
    const data = store[unit_id]
    const idx = data.companies.findIndex(c => c.id === unit_company_id)
    if (idx !== -1) {
      const removed = data.companies.splice(idx, 1)[0]
      // disassociate sections from this company
      data.sections = data.sections.map(s => (s.company_id === removed.company_id ? { ...s, company_id: undefined } : s))
      saveStore(store)
      return
    }
  }
  throw new Error('Company not found')
}

export const listSections = async (unit_id: string): Promise<UnitSection[]> => {
  const fromFile = await loadUnitStructureFromFiles(unit_id)
  const store = loadStore()
  const data = ensureUnit(store, unit_id)
  const fileSections: UnitSection[] = Array.isArray(fromFile?.sections)
    ? fromFile.sections.map((s: any) => ({
        id: Number(s.id) || Date.now(),
        unit_id,
        section_name: s.section_name,
        display_name: s.display_name,
        company_id: s.company_id,
      }))
    : []
  const all = [...fileSections, ...data.sections]
  const key = (s: UnitSection) => `${s.company_id || ''}::${s.section_name}`
  const dedup = Array.from(new Map(all.map(s => [key(s), s])).values())
  return dedup
}

export const createSection = async (unit_id: string, section_name: string, extra: Partial<UnitSection> = {}): Promise<void> => {
  const store = loadStore()
  const data = ensureUnit(store, unit_id)
  const id = Date.now()
  data.sections.push({ id, unit_id, section_name, ...extra })
  saveStore(store)
}

export const deleteSection = async (unit_section_id: number): Promise<void> => {
  const store = loadStore()
  for (const unit_id of Object.keys(store)) {
    const data = store[unit_id]
    const idx = data.sections.findIndex(s => s.id === unit_section_id)
    if (idx !== -1) {
      data.sections.splice(idx, 1)
      saveStore(store)
      return
    }
  }
  throw new Error('Section not found')
}

export const updateSection = async (unit_section_id: number, patch: Partial<UnitSection>): Promise<void> => {
  const store = loadStore()
  for (const unit_id of Object.keys(store)) {
    const data = store[unit_id]
    const idx = data.sections.findIndex(s => s.id === unit_section_id)
    if (idx !== -1) {
      const current = data.sections[idx]
      const next: UnitSection = { ...current, ...patch }
      if (next.company_id && !data.companies.some(c => c.company_id === next.company_id)) {
        data.companies.push({ id: Date.now(), unit_id, company_id: next.company_id })
      }
      data.sections[idx] = next
      saveStore(store)
      return
    }
  }
  throw new Error('Section not found')
}

export const loadUnitStructureFromBundle = async (): Promise<Record<string, any>> => {
  const store = loadStore()
  const bundle: Record<string, any> = {}
  for (const unit_id of Object.keys(store)) {
    const data = store[unit_id]
    const companies = (data.companies || []).map(c => ({
      id: c.company_id,
      name: c.display_name || c.company_id,
      platoons: [],
    }))
    bundle[unit_id] = { companies }
  }
  return bundle
}

export const loadUnitStructureFromFiles = async (unit_id: string): Promise<any | null> => {
  const ruc = unit_id && unit_id.includes('-') ? unit_id.split('-')[1] : unit_id
  // Prefer RUC-level file to avoid 404s when unit-specific files are absent
  if (ruc) {
    try {
      const rucPath = `/data/unit-structure/${encodeURIComponent(ruc)}.json`
      const rucData = await fetchJson<any>(rucPath)
      if (rucData) return rucData
    } catch {}
  }
  // Fallback to unit-specific file
  try {
    const unitPath = `/data/unit-structure/${encodeURIComponent(unit_id)}.json`
    const unitData = await fetchJson<any>(unitPath)
    return unitData || null
  } catch {
    return null
  }
}
import { fetchJson } from '@/services/localDataService'
