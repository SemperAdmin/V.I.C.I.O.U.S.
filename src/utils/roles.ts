export const normalizeOrgRole = (role?: string): 'Unit_Admin' | 'Unit_Manager' | 'Company_Manager' | 'Section_Manager' | 'Member' | 'App_Admin' | '' => {
  const r = String(role || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (r === 'unit_admin' || r === 'unitadmin') return 'Unit_Admin'
  if (r === 'unit_manager' || r === 'unitmanager' || r === 'unit_lead') return 'Unit_Manager'
  if (r === 'company_manager' || r === 'companymanager' || r === 'company_lead') return 'Company_Manager'
  if (r === 'section_manager' || r === 'sectionmanager' || r === 'section_lead') return 'Section_Manager'
  if (r === 'app_admin' || r === 'appadmin' || r === 'admin') return 'App_Admin'
  if (r === 'member') return 'Member'
  return ''
}

export const normalizeSectionRole = (role?: string): 'Section_Reviewer' | 'Member' | '' => {
  const r = String(role || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (r === 'section_reviewer' || r === 'reviewer') return 'Section_Reviewer'
  if (r === 'member') return 'Member'
  return ''
}
