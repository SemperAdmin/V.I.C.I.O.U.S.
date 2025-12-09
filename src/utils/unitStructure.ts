import type { UnitSection as SUnitSection, UnitCompany as SUnitCompany } from '@/services/supabaseUnitConfigService'
import { listCompanies as sbListCompanies, createCompany as sbCreateCompany, deleteCompany as sbDeleteCompany, listSections as sbListSections, createSection as sbCreateSection, deleteSection as sbDeleteSection, updateSection as sbUpdateSection } from '@/services/supabaseUnitConfigService'

export type UnitCompany = SUnitCompany
export type UnitSection = SUnitSection

export const listCompanies = async (unit_id: string): Promise<UnitCompany[]> => {
  return sbListCompanies(unit_id)
}

export const createCompany = async (unit_id: string, company_id: string, display_name?: string): Promise<void> => {
  await sbCreateCompany(unit_id, company_id, display_name)
}

export const deleteCompany = async (unit_company_id: number): Promise<void> => {
  await sbDeleteCompany(unit_company_id)
}

export const listSections = async (unit_id: string): Promise<UnitSection[]> => {
  return sbListSections(unit_id)
}

export const createSection = async (unit_id: string, section_name: string, extra: Partial<UnitSection> = {}): Promise<void> => {
  await sbCreateSection(unit_id, section_name, extra)
}

export const deleteSection = async (unit_section_id: number): Promise<void> => {
  await sbDeleteSection(unit_section_id)
}

export const updateSection = async (unit_section_id: number, patch: Partial<UnitSection>): Promise<void> => {
  await sbUpdateSection(unit_section_id, patch)
}
