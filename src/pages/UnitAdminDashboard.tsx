import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { listSubTasks, createSubTask, deleteSubTask, updateSubTask } from '@/utils/unitTasks'
import { listForms, createForm, deleteForm, updateForm, UnitForm, UnitFormPurpose } from '@/utils/formsStore'
import { listSections, createSection, deleteSection, listCompanies, createCompany, deleteCompany, updateSection, UnitSection, UnitCompany } from '@/utils/unitStructure'
import HeaderTools from '@/components/HeaderTools'
import { fetchJson, LocalUserProfile, UsersIndexEntry } from '@/services/localDataService'
import { getRoleOverride, setUserRoleOverride } from '@/utils/localUsersStore'
import { UNITS } from '@/utils/units'
import { getAssignedUnitsForRuc, setAssignedUnitsForRuc } from '@/utils/adminScopeStore'
import { sbListUnitAdmins, sbUpsertUnitAdmin, sbRemoveUnitAdmin } from '@/services/adminService'
import { getUnitAdmins, addUnitAdmin, removeUnitAdmin } from '@/utils/unitAdminsStore'
import { sbListUsersByRuc, sbUpdateUser } from '@/services/supabaseDataService'

export default function UnitAdminDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'structure' | 'tasks' | 'members' | 'forms' | 'assign'>('structure')
  const [sections, setSections] = useState<UnitSection[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [forms, setForms] = useState<UnitForm[]>([])
  const [newSectionName, setNewSectionName] = useState('')
  const [newTask, setNewTask] = useState({ section_id: 0, sub_task_id: '', description: '', responsible_user_ids: '', location: '', instructions: '' })
  const initialRuc = (user?.unit_id || '').includes('-') ? (user?.unit_id || '').split('-')[1] : (user?.unit_id || '')
  const [managedRuc, setManagedRuc] = useState(initialRuc)
  const unitId = managedRuc
  const rucDisplay = managedRuc
  const [companies, setCompanies] = useState<string[]>([])
  const [companyRows, setCompanyRows] = useState<UnitCompany[]>([])
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newSectionDisplay, setNewSectionDisplay] = useState('')
  const [sectionOptions, setSectionOptions] = useState<UnitSection[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCompanyId, setEditCompanyId] = useState('')
  const [editSectionCode, setEditSectionCode] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [edipiMap, setEdipiMap] = useState<Record<string, LocalUserProfile>>({})
  const [tasksError, setTasksError] = useState('')
  const [formsError, setFormsError] = useState('')
  const [taskEditingId, setTaskEditingId] = useState<number | null>(null)
  const [taskEditDescription, setTaskEditDescription] = useState('')
  const [taskEditLocation, setTaskEditLocation] = useState('')
  const [taskEditInstructions, setTaskEditInstructions] = useState('')
  const [taskEditCompletionKind, setTaskEditCompletionKind] = useState<'Text' | 'Date' | 'Options' | ''>('')
  const [taskEditCompletionLabel, setTaskEditCompletionLabel] = useState('')
  const [taskEditCompletionOptions, setTaskEditCompletionOptions] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  const [newFormKind, setNewFormKind] = useState<'Inbound' | 'Outbound'>('Inbound')
  const [newFormTaskIds, setNewFormTaskIds] = useState<string[]>([])
  const [editingFormId, setEditingFormId] = useState<number | null>(null)
  const [newFormPurpose, setNewFormPurpose] = useState<UnitFormPurpose>('PCS')
  const [platoons, setPlatoons] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(user?.company_id)
  const [selectedPlatoon, setSelectedPlatoon] = useState<string | undefined>(user?.platoon_id)
  const [defaultEdipis, setDefaultEdipis] = useState<string[]>([])
  const [companiesError, setCompaniesError] = useState<string>('')
  const [rucOptions, setRucOptions] = useState<Array<{ id: string; name: string }>>([])
  const [unitsForRuc, setUnitsForRuc] = useState<Array<{ id: string; name: string; uic?: string; ruc?: string; mcc?: string }>>([])
  const [assignedUnits, setAssignedUnits] = useState<string[]>([])
  const [assignTab, setAssignTab] = useState<'assigned' | 'unassigned'>('assigned')
  const [addAdminForUnit, setAddAdminForUnit] = useState<string | null>(null)
  const [addAdminSelectedEdipi, setAddAdminSelectedEdipi] = useState<string>('')
  const [globalAdmins, setGlobalAdmins] = useState<Array<{ unit_key: string; unit_name: string; admin_user_id: string; ruc?: string }>>([])
  const [pendingRoles, setPendingRoles] = useState<Record<string, 'Section_Manager' | 'Member'>>({})
  const [pendingCompanyForEdipi, setPendingCompanyForEdipi] = useState<Record<string, string>>({})
  const [pendingSectionForEdipi, setPendingSectionForEdipi] = useState<Record<string, string>>({})

  useEffect(() => {
    const items = UNITS.filter(u => String(u.ruc) === managedRuc)
      .map(u => ({ id: `${u.uic}-${u.ruc}-${u.mcc}`, name: u.unitName, uic: u.uic, ruc: u.ruc, mcc: u.mcc }))
    setUnitsForRuc(items)
    const preset = getAssignedUnitsForRuc(user?.edipi || '', managedRuc)
    const own = (user?.unit_id || '')
    const next = Array.from(new Set([...preset, own].filter(Boolean)))
    setAssignedUnits(next)
    setAssignedUnitsForRuc(user?.edipi || '', managedRuc, next)
    if (!unitId) return
    const load = async () => {
      const secs = await listSections(unitId)
      setSections(secs)
      setSectionOptions(secs)
      const tsks = await listSubTasks(unitId)
      setTasks(tsks)
      setForms(await listForms(unitId))
      const comps = await listCompanies(unitId)
      setCompanyRows(comps)
      const ids = comps.map(c => c.company_id)
      setCompanies(ids)
      if (!selectedCompany && ids.length) setSelectedCompany(ids[0])

      if (tsks.length === 0) {
        const fList = await listForms(unitId)
        const allIds = Array.from(new Set(fList.flatMap(f => f.task_ids)))
        if (allIds.length) {
          const sectionByCode = new Map<string, number>()
          for (const s of secs) {
            sectionByCode.set(s.section_name, s.id)
            const disp = (s as any).display_name
            if (disp) sectionByCode.set(String(disp), s.id)
          }
          for (const tid of allIds) {
            const prefix = String(tid).split('-')[0]
            const sid = sectionByCode.get(prefix) || secs[0]?.id || 0
            if (!sid) continue
            try {
              await createSubTask({ unit_id: unitId, section_id: sid, sub_task_id: tid, description: String(tid), responsible_user_ids: defaultEdipis })
            } catch {}
          }
          const refreshed = await listSubTasks(unitId)
          setTasks(refreshed)
        }
      }
    }
    load()
  }, [unitId])

  useEffect(() => {
    const rucs = Array.from(new Set(UNITS.map(u => u.ruc).filter(Boolean)))
    setRucOptions(rucs.map(r => ({ id: String(r), name: `RUC ${r}` })))
    const initial = UNITS.filter(u => String(u.ruc) === managedRuc)
      .map(u => ({ id: `${u.uic}-${u.ruc}-${u.mcc}`, name: u.unitName, uic: u.uic, ruc: u.ruc, mcc: u.mcc }))
    setUnitsForRuc(initial)
    const preset = getAssignedUnitsForRuc(user?.edipi || '', managedRuc)
    const own = (user?.unit_id || '')
    const next = Array.from(new Set([...preset, own].filter(Boolean)))
    setAssignedUnits(next)
    setAssignedUnitsForRuc(user?.edipi || '', managedRuc, next)
    ;(async () => {
      try {
        const admins = await sbListUnitAdmins()
        setGlobalAdmins(admins)
      } catch {
        setGlobalAdmins([])
      }
    })()
  }, [])

  useEffect(() => {
    const filtered = selectedCompany ? sections.filter(s => (s as any).company_id === selectedCompany) : sections
    setSectionOptions(filtered)
  }, [sections, selectedCompany])

  useEffect(() => {
    if (!unitId) return
    const loadUsers = async () => {
      let profiles: LocalUserProfile[] = []
      const assignedUnion = new Set<string>([...assignedUnits, user?.unit_id || ''].filter(Boolean))

      // Try Supabase first, fallback to JSON files
      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        try {
          // Get all users for this RUC from Supabase
          const allUsers = await sbListUsersByRuc(unitId)
          // Filter by assigned units if needed
          profiles = allUsers.filter(profile =>
            assignedUnion.size === 0 || assignedUnion.has(profile.unit_id)
          )
        } catch (err) {
          console.warn('Supabase listUsersByRuc failed, using JSON fallback:', err)
          // Fall through to JSON loading
        }
      }

      // Fallback to JSON files if Supabase not enabled or failed
      if (profiles.length === 0) {
        const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
        for (const entry of index.users) {
          const profile = await fetchJson<LocalUserProfile>(`/${entry.path}`)
          const pruc = (profile.unit_id || '').includes('-') ? (profile.unit_id || '').split('-')[1] : (profile.unit_id || '')
          if (String(pruc) === String(unitId) && (assignedUnion.size === 0 || assignedUnion.has(profile.unit_id))) {
            profiles.push(profile)
          }
        }
      }

      // Add current user if they match the RUC
      const selfPruc = (user?.unit_id || '').includes('-') ? (user?.unit_id || '').split('-')[1] : (user?.unit_id || '')
      if (user && String(selfPruc) === String(unitId) && (assignedUnion.size === 0 || assignedUnion.has(user.unit_id!))) {
        if (!profiles.find(p => p.edipi === user.edipi)) profiles.push(user as any as LocalUserProfile)
      }

      const companySet = new Set<string>([...companies, ...profiles.map(p => p.company_id!).filter(Boolean)])
      const platoonSet = new Set<string>(profiles.map(p => p.platoon_id!).filter(Boolean))
      const companyList = Array.from(companySet)
      const platoonList = Array.from(platoonSet)
      setCompanies(companyList)
      setPlatoons(platoonList)
      if (!selectedCompany && companyList.length) setSelectedCompany(companyList[0])
      if (!selectedPlatoon && platoonList.length) setSelectedPlatoon(platoonList[0])
      const eds = profiles
        .filter(p => (!selectedCompany || p.company_id === selectedCompany) && (!selectedPlatoon || p.platoon_id === selectedPlatoon))
        .map(p => p.edipi)
      setDefaultEdipis(eds)
      setEdipiMap(Object.fromEntries(profiles.map(p => [p.edipi, p])))
    }
    loadUsers()
  }, [unitId, selectedCompany, selectedPlatoon, assignedUnits])

  const overrideRole = getRoleOverride(user?.edipi || '')?.org_role
  const hasUnitAdmin = !!(user?.is_app_admin || user?.is_unit_admin || overrideRole === 'Unit_Admin' || user?.org_role === 'Unit_Admin')
  if (!user || !hasUnitAdmin) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Access denied</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <header className="bg-github-gray bg-opacity-10 border-b border-github-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-white">Unit Admin — RUC {rucDisplay}</h1>
            <HeaderTools />
          </div>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl">
          <div className="flex border-b border-github-border">
            <button
              onClick={() => setTab('members')}
              className={`px-4 py-3 text-sm ${tab === 'members' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Assigned Members
            </button>
            <button
              onClick={() => setTab('forms')}
              className={`px-4 py-3 text-sm ${tab === 'forms' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Forms
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={`px-4 py-3 text-sm ${tab === 'tasks' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Tasks
            </button>
            <button
              onClick={() => setTab('assign')}
              className={`px-4 py-3 text-sm ${tab === 'assign' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Unit Management
            </button>
            <button
              onClick={() => setTab('structure')}
              className={`px-4 py-3 text-sm ${tab === 'structure' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Unit Structure
            </button>
          </div>
          
          <div className="p-6">
            {tab === 'assign' && (
              <div className="space-y-4">
                <div className="text-gray-300">Assign units under RUC {rucDisplay} to manage</div>
                <div className="flex border-b border-github-border">
                  <button
                    onClick={() => setAssignTab('assigned')}
                    className={`px-4 py-2 text-sm ${assignTab === 'assigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
                  >
                    Assigned Units
                  </button>
                  <button
                    onClick={() => setAssignTab('unassigned')}
                    className={`px-4 py-2 text-sm ${assignTab === 'unassigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
                  >
                    Unassigned Units
                  </button>
                </div>
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Unit</th>
                      <th className="text-left p-2">UIC</th>
                      <th className="text-left p-2">RUC</th>
                      <th className="text-left p-2">MCC</th>
                      <th className="text-left p-2">Unit Admin</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const assignedUnion = Array.from(new Set([
                        ...assignedUnits,
                        ...globalAdmins.map(a => a.unit_key),
                      ]))
                      const list = assignTab === 'assigned'
                        ? unitsForRuc.filter(u => assignedUnion.includes(u.id))
                        : unitsForRuc.filter(u => !assignedUnion.includes(u.id) && String(u.ruc) === String(managedRuc))
                      return list
                    })().map(u => (
                      <tr key={u.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">
                          <div className="text-white">{u.name}</div>
                          <div className="text-gray-300 text-sm">{[user?.rank, [user?.first_name, user?.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ')}</div>
                        </td>
                        <td className="p-2">{u.uic}</td>
                        <td className="p-2">{u.ruc}</td>
                        <td className="p-2">{u.mcc}</td>
                        <td className="p-2">
                          {assignTab === 'assigned' ? (() => {
                            const ga = globalAdmins.find(a => a.unit_key === u.id)
                            const ed = ga?.admin_user_id || (getUnitAdmins(u.id)[0] || user?.edipi || '')
                            if (!ed) return 'None'
                            const p = edipiMap[ed]
                            const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
                            const disp = [p?.rank, nm].filter(Boolean).join(' ')
                            return disp || ed
                          })() : 'None'}
                        </td>
                        <td className="p-2">
                          {assignTab === 'assigned' ? (
                            <>
                              {addAdminForUnit === u.id ? (
                                <>
                                  <div className="mb-2">
                                    <div className="text-xs text-gray-400 mb-1">Current admins</div>
                                    <div className="flex flex-wrap gap-2">
                                      {getUnitAdmins(u.id).map(ed => {
                                        const p = edipiMap[ed]
                                        const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
                                        const disp = [p?.rank, nm].filter(Boolean).join(' ')
                                        return (
                                          <span key={ed} className="inline-flex items-center gap-2 px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                                            {disp || ed}
                                            <button
                                              onClick={() => {
                                                (async () => {
                                                  const ga = globalAdmins.find(a => a.unit_key === u.id)
                                                  if (ga) {
                                                    await sbRemoveUnitAdmin(u.id, ed)
                                                    const admins = await sbListUnitAdmins()
                                                    setGlobalAdmins(admins)
                                                  } else {
                                                    removeUnitAdmin(u.id, ed)
                                                  }
                                                })()
                                              }}
                                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                            >
                                              Remove
                                            </button>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  <select
                                    value={addAdminSelectedEdipi}
                                    onChange={e => setAddAdminSelectedEdipi(e.target.value)}
                                    className="px-3 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white mr-2"
                                  >
                                    <option value="">Select member</option>
                                    {Object.values(edipiMap).map(p => (
                                      <option key={p.edipi} value={p.edipi}>
                                        {[p.rank, [p.first_name, p.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ')}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      if (!addAdminSelectedEdipi) return
                                  (async () => {
                                    try {
                                      await sbUpsertUnitAdmin(u.id, u.name, addAdminSelectedEdipi)
                                      const admins = await sbListUnitAdmins()
                                      setGlobalAdmins(admins)
                                    } catch {
                                      addUnitAdmin(u.id, addAdminSelectedEdipi)
                                    }
                                  })()
                                  setAddAdminForUnit(null)
                                  setAddAdminSelectedEdipi('')
                                }}
                                className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded mr-2"
                              >
                                Add
                              </button>
                                  <button
                                    onClick={() => {
                                      setAddAdminForUnit(null)
                                      setAddAdminSelectedEdipi('')
                                    }}
                                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                                  >
                                    Done
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setAddAdminForUnit(u.id)}
                                  className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded mr-2"
                                >
                                  Manage
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  const next = Array.from(new Set([...assignedUnits, u.id]))
                                  setAssignedUnits(next)
                                  setAssignedUnitsForRuc(user?.edipi || '', managedRuc, next)
                                }}
                                className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded mr-2"
                              >
                                Assign
                              </button>
                              <button
                                onClick={() => setAddAdminForUnit(u.id)}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
                              >
                                Manage
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'structure' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  
                  {companies.length === 0 && (
                    <div className="text-yellow-400 text-sm">No companies available. Create one below.</div>
                  )}
                </div>
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Company</th>
                      <th className="text-left p-2">Section</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-github-border">
                      <td className="p-2">
                        <input
                          value={newCompanyId}
                          onChange={e => setNewCompanyId(e.target.value)}
                          placeholder="Company"
                          className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={newSectionName}
                          onChange={e => setNewSectionName(e.target.value)}
                          placeholder="Section code"
                          className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={newSectionDisplay}
                          onChange={e => setNewSectionDisplay(e.target.value)}
                          placeholder="Name"
                          className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          disabled={!newCompanyId.trim() || !newSectionName.trim() || !newSectionDisplay.trim()}
                          onClick={async () => {
                            setCompaniesError('')
                            if (!newCompanyId.trim() || !newSectionName.trim() || !newSectionDisplay.trim()) return
                            try {
                              const existing = await listCompanies(unitId)
                              const exists = existing.some(c => c.company_id === newCompanyId.trim())
                              if (!exists) {
                                await createCompany(unitId, newCompanyId.trim(), newCompanyName.trim() || undefined)
                              }
                              await createSection(unitId, newSectionName.trim(), { company_id: newCompanyId.trim(), display_name: newSectionDisplay.trim() })
                              const comps = await listCompanies(unitId)
                              setCompanyRows(comps)
                              const ids = comps.map(c => c.company_id)
                              setCompanies(ids)
                              setSelectedCompany(newCompanyId.trim())
                              setSections(await listSections(unitId))
                              setNewCompanyId('')
                              setNewCompanyName('')
                              setNewSectionName('')
                              setNewSectionDisplay('')
                            } catch (err: any) {
                              const msg = err?.message || (err?.error?.message ?? '') || String(err)
                              setCompaniesError(msg || 'Failed to create company/section')
                            }
                          }}
                          className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                        >
                          Create Section
                        </button>
                      </td>
                    </tr>
                    {sections.map(s => (
                      <tr key={s.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">
                          {editingId === s.id ? (
                            <input value={editCompanyId} onChange={e => setEditCompanyId(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                          ) : (
                            (s as any).company_id || ''
                          )}
                        </td>
                        <td className="p-2">
                          {editingId === s.id ? (
                            <input value={editSectionCode} onChange={e => setEditSectionCode(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                          ) : (
                            s.section_name
                          )}
                        </td>
                        <td className="p-2">
                          {editingId === s.id ? (
                            <input value={editDisplay} onChange={e => setEditDisplay(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                          ) : (
                            (s as any).display_name || ''
                          )}
                        </td>
                        <td className="p-2 flex gap-2">
                          {editingId === s.id ? (
                            <>
                              <button
                                onClick={async () => {
                                  const patch: Partial<UnitSection> = {
                                    company_id: editCompanyId || undefined,
                                    section_name: editSectionCode || s.section_name,
                                    display_name: editDisplay || (s as any).display_name,
                                  }
                                  await updateSection(s.id, patch)
                                  setSections(await listSections(unitId))
                                  setEditingId(null)
                                  setEditCompanyId('')
                                  setEditSectionCode('')
                                  setEditDisplay('')
                                }}
                                className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null)
                                  setEditCompanyId('')
                                  setEditSectionCode('')
                                  setEditDisplay('')
                                }}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(s.id)
                                  setEditCompanyId((s as any).company_id || '')
                                  setEditSectionCode(s.section_name)
                                  setEditDisplay((s as any).display_name || '')
                                }}
                                className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  await deleteSection(s.id)
                                  setSections(await listSections(unitId))
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {companiesError && (
                  <div className="text-red-400 text-sm">{companiesError}</div>
                )}
              </div>
            )}
            {tab === 'tasks' && (
              <div className="space-y-6">
                <button
                  onClick={async () => {
                    setTasksError('')
                    const secs = await listSections(unitId)
                    setSections(secs)
                    setSectionOptions(secs)
                    const defaultSectionId = secs[0]?.id || 0
                    setNewTask({ section_id: defaultSectionId, sub_task_id: '', description: '', responsible_user_ids: defaultEdipis.join(', '), location: '', instructions: '' })
                    setCreateModalOpen(true)
                  }}
                  className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                >
                  Create Task
                </button>
                {tasksError && (
                  <div className="text-red-400 text-sm">{tasksError}</div>
                )}
                {createModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-6">
                      <h3 className="text-white text-lg mb-4">Create Task</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <select
                          value={newTask.section_id}
                          onChange={e => {
                            const section_id = Number(e.target.value)
                            setNewTask({ ...newTask, section_id })
                          }}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value={0}>Select section</option>
                          {sectionOptions.map(s => (
                            <option key={s.id} value={s.id}>{(s as any).display_name || s.section_name}</option>
                          ))}
                        </select>
                        <textarea
                          value={newTask.description}
                          onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                          placeholder="Description"
                          rows={4}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        <input
                          value={newTask.location}
                          onChange={e => setNewTask({ ...newTask, location: e.target.value })}
                          placeholder="Location"
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        <textarea
                          value={newTask.instructions}
                          onChange={e => setNewTask({ ...newTask, instructions: e.target.value })}
                          placeholder="Special instructions"
                          rows={4}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        <select
                          value={taskEditCompletionKind}
                          onChange={e => setTaskEditCompletionKind(e.target.value as any)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="">Completion type</option>
                          <option value="Text">Text</option>
                          <option value="Date">Date</option>
                          <option value="Options">Options</option>
                        </select>
                        <input
                          value={taskEditCompletionLabel}
                          onChange={e => setTaskEditCompletionLabel(e.target.value)}
                          placeholder="Completion label"
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        {taskEditCompletionKind === 'Options' && (
                          <input
                            value={taskEditCompletionOptions}
                            onChange={e => setTaskEditCompletionOptions(e.target.value)}
                            placeholder="Completion options (comma-separated)"
                            className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                          />
                        )}
                      </div>
                      <div className="mt-6 flex gap-2 justify-end">
                        <button
                          onClick={async () => {
                            setTasksError('')
                            if (!newTask.section_id || !newTask.description.trim()) return
                            const ids = defaultEdipis
                            const section = sections.find(s => s.id === newTask.section_id)
                            const prefix = section?.section_name || 'TASK'
                            const next = (tasks.filter(t => t.section_id === newTask.section_id).length + 1)
                            const sub_task_id = `${prefix}-${String(next).padStart(2, '0')}`
                          try {
                            await createSubTask({
                              unit_id: unitId,
                              section_id: newTask.section_id,
                              sub_task_id,
                              description: newTask.description.trim(),
                              responsible_user_ids: ids,
                              location: newTask.location.trim() || undefined,
                              instructions: newTask.instructions.trim() || undefined,
                              completion_kind: taskEditCompletionKind || undefined,
                              completion_label: taskEditCompletionLabel.trim() || undefined,
                              completion_options: taskEditCompletionKind === 'Options' ? taskEditCompletionOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                            })
                            setTasks(await listSubTasks(unitId))
                            setCreateModalOpen(false)
                            setNewTask({ section_id: 0, sub_task_id: '', description: '', responsible_user_ids: '', location: '', instructions: '' })
                            setTaskEditCompletionKind('')
                            setTaskEditCompletionLabel('')
                            setTaskEditCompletionOptions('')
                          } catch (err: any) {
                            const msg = err?.message || String(err)
                            setTasksError(msg || 'Failed to add sub task')
                          }
                          }}
                          className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setCreateModalOpen(false)
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Section</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Location</th>
                      <th className="text-left p-2">Instructions</th>
                      <th className="text-left p-2">Responsible</th>
                      <th className="text-left p-2">Completion</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">{(() => {
                          const sec = sections.find(s => s.id === t.section_id)
                          return (sec as any)?.display_name || sec?.section_name || ''
                        })()}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditDescription} onChange={e => setTaskEditDescription(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.description)}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditLocation} onChange={e => setTaskEditLocation(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.location || '')}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditInstructions} onChange={e => setTaskEditInstructions(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.instructions || '')}</td>
                        <td className="p-2">{(t.responsible_user_ids || []).map((id: string) => {
                          const u = edipiMap[id]
                          const rank = u?.rank || ''
                          const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ')
                          const disp = [rank, name].filter(Boolean).join(' ')
                          return disp || id
                        }).join(', ')}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <div className="grid grid-cols-1 gap-2">
                            <select value={taskEditCompletionKind} onChange={e => setTaskEditCompletionKind(e.target.value as any)} className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                              <option value="">Completion type</option>
                              <option value="Text">Text</option>
                              <option value="Date">Date</option>
                              <option value="Options">Options</option>
                            </select>
                            <input value={taskEditCompletionLabel} onChange={e => setTaskEditCompletionLabel(e.target.value)} placeholder="Label" className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                            {taskEditCompletionKind === 'Options' && (
                              <input value={taskEditCompletionOptions} onChange={e => setTaskEditCompletionOptions(e.target.value)} placeholder="Options (comma-separated)" className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                            )}
                          </div>
                        ) : (
                          [t.completion_kind, t.completion_label, (t.completion_options || []).join('/')].filter(Boolean).join(' • ')
                        )}</td>
                        <td className="p-2 flex gap-2">
                          {taskEditingId === t.id ? (
                            <>
                              <button
                                onClick={async () => {
                                  await updateSubTask(t.id, {
                                    description: taskEditDescription.trim(),
                                    location: taskEditLocation.trim() || undefined,
                                    instructions: taskEditInstructions.trim() || undefined,
                                    completion_kind: taskEditCompletionKind || undefined,
                                    completion_label: taskEditCompletionLabel.trim() || undefined,
                                    completion_options: taskEditCompletionKind === 'Options' ? taskEditCompletionOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                                  })
                                  setTasks(await listSubTasks(unitId))
                                  setTaskEditingId(null)
                                  setTaskEditDescription('')
                                  setTaskEditLocation('')
                                  setTaskEditInstructions('')
                                  setTaskEditCompletionKind('')
                                  setTaskEditCompletionLabel('')
                                  setTaskEditCompletionOptions('')
                                }}
                                className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setTaskEditingId(null)
                                  setTaskEditDescription('')
                                  setTaskEditLocation('')
                                  setTaskEditInstructions('')
                                }}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setTaskEditingId(t.id)
                                  setTaskEditDescription(t.description || '')
                                  setTaskEditLocation(t.location || '')
                                  setTaskEditInstructions(t.instructions || '')
                                  setTaskEditCompletionKind((t.completion_kind as any) || '')
                                  setTaskEditCompletionLabel(t.completion_label || '')
                                  setTaskEditCompletionOptions((t.completion_options || []).join(', '))
                                }}
                                className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  await deleteSubTask(t.id)
                                  setTasks(await listSubTasks(unitId))
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
              </div>
            )}
            {tab === 'forms' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="text-gray-300">Create inbound/outbound requirements from unit tasks</div>
                  <button
                    onClick={() => {
                      setFormsError('')
                      setEditingFormId(null)
                      setNewFormName('')
                      setNewFormKind('Inbound')
                      setNewFormTaskIds([])
                      setNewFormPurpose('PCS')
                      setCreateModalOpen(true)
                    }}
                    className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                  >
                    Create Form
                  </button>
                </div>

                {createModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-6">
                      <h3 className="text-white text-lg mb-4">{editingFormId ? 'Edit Form' : 'New Form'}</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <input
                          value={newFormName}
                          onChange={e => setNewFormName(e.target.value)}
                          placeholder="Form name"
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        <select
                          value={newFormKind}
                          onChange={e => setNewFormKind(e.target.value as any)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="Inbound">Inbound</option>
                          <option value="Outbound">Outbound</option>
                        </select>
                        <select
                          value={newFormPurpose}
                          onChange={e => setNewFormPurpose(e.target.value as UnitFormPurpose)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="Fleet_Assistance_Program">Fleet Assistance Program</option>
                          <option value="TAD_31_plus_days">Temporary Additional Duty 31+ days</option>
                          <option value="TAD_30_or_less">Temporary Additional Duty 30 days or less</option>
                          <option value="PCA">Permanent Change of Assignment</option>
                          <option value="PCS">Permanent Change of Station</option>
                          <option value="Separation">Separation</option>
                          <option value="Retirement">Retirement</option>
                        </select>
                        <div className="max-h-40 overflow-auto space-y-2">
                          {tasks.map(t => {
                            const sec = sections.find(s => s.id === t.section_id)
                            const secLabel = (sec as any)?.display_name || sec?.section_name || ''
                            return (
                              <label key={t.id} className="flex items-center gap-2 text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={newFormTaskIds.includes(t.sub_task_id)}
                                  onChange={e => {
                                    const id = t.sub_task_id
                                    const next = new Set(newFormTaskIds)
                                    if (e.target.checked) next.add(id); else next.delete(id)
                                    setNewFormTaskIds(Array.from(next))
                                  }}
                                />
                                <span>{secLabel} - {t.description}</span>
                              </label>
                            )
                          })}
                        </div>
                        <div className="space-y-2">
                          <div className="text-gray-400 text-sm">Selected tasks</div>
                          <div className="flex flex-wrap gap-2">
                            {newFormTaskIds.map(id => (
                              <span key={id} className="inline-flex items-center gap-2 px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                                {id}
                                <button
                                  onClick={() => {
                                    const next = newFormTaskIds.filter(x => x !== id)
                                    setNewFormTaskIds(next)
                                  }}
                                  className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                                >
                                  Remove
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-2 justify-end">
                        <button
                          onClick={async () => {
                            setFormsError('')
                            try {
                              if (!newFormName.trim()) throw new Error('Name is required')
                              if (editingFormId) {
                                await updateForm(unitId, editingFormId, { name: newFormName.trim(), kind: newFormKind, task_ids: newFormTaskIds, purpose: newFormPurpose })
                              } else {
                                await createForm(unitId, newFormName.trim(), newFormKind, newFormTaskIds, newFormPurpose)
                              }
                              setForms(await listForms(unitId))
                              setCreateModalOpen(false)
                              setEditingFormId(null)
                            } catch (err: any) {
                              const msg = err?.message || String(err)
                              setFormsError(msg || 'Failed to save form')
                            }
                          }}
                          className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setCreateModalOpen(false); setEditingFormId(null) }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Purpose</th>
                      <th className="text-left p-2">Tasks</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map(f => (
                      <tr key={f.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">{f.name}</td>
                        <td className="p-2">{f.kind}</td>
                        <td className="p-2">{(() => {
                          switch (f.purpose) {
                            case 'Fleet_Assistance_Program': return 'Fleet Assistance Program'
                            case 'TAD_31_plus_days': return 'Temporary Additional Duty 31+ days'
                            case 'TAD_30_or_less': return 'Temporary Additional Duty 30 days or less'
                            case 'PCA': return 'Permanent Change of Assignment'
                            case 'PCS': return 'Permanent Change of Station'
                            case 'Separation': return 'Separation'
                            case 'Retirement': return 'Retirement'
                            default: return ''
                          }
                        })()}</td>
                        <td className="p-2">{f.task_ids.length}</td>
                        <td className="p-2 flex gap-2">
                          <button
                            onClick={() => {
                              setFormsError('')
                              setEditingFormId(f.id)
                              setNewFormName(f.name)
                              setNewFormKind(f.kind)
                              setNewFormTaskIds(f.task_ids)
                              setNewFormPurpose((f.purpose as UnitFormPurpose) || 'PCS')
                              ;(async () => { setTasks(await listSubTasks(unitId)) })()
                              setCreateModalOpen(true)
                            }}
                            className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              await deleteForm(unitId, f.id)
                              setForms(await listForms(unitId))
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {formsError && (
                  <div className="text-red-400 text-sm">{formsError}</div>
                )}
              </div>
            )}
            {tab === 'members' && (
              <div className="space-y-6">
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Member</th>
                      <th className="text-left p-2">Company</th>
                      <th className="text-left p-2">Section</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(edipiMap).map(p => {
                      const override = getRoleOverride(p.edipi)
                      const role = override?.org_role || p.org_role || 'Member'
                      const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
                      const company = p.company_id || ''
                      const sectionLabel = (() => {
                        const byId = sections.find(s => String(s.id) === String(p.platoon_id))
                        if (byId) return (byId as any).display_name || byId.section_name
                        const byCode = sections.find(s => s.section_name === p.platoon_id)
                        return (byCode as any)?.display_name || byCode?.section_name || ''
                      })()
                      return (
                        <tr key={p.edipi} className="border-t border-github-border text-gray-300">
                          <td className="p-2">{[p.rank, name].filter(Boolean).join(' ')}</td>
                          <td className="p-2">
                            <select
                              value={pendingCompanyForEdipi[p.edipi] ?? company}
                              onChange={e => setPendingCompanyForEdipi(prev => ({ ...prev, [p.edipi]: e.target.value }))}
                              className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                            >
                              <option value="">Select company</option>
                              {companies.map(cid => (
                                <option key={cid} value={cid}>{cid}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={pendingSectionForEdipi[p.edipi] ?? String(p.platoon_id || '')}
                              onChange={e => setPendingSectionForEdipi(prev => ({ ...prev, [p.edipi]: e.target.value }))}
                              className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                            >
                              <option value="">Select section</option>
                              {(company ? sections.filter(s => (s as any).company_id === company) : sections).map(s => (
                                <option key={s.id} value={String(s.id)}>{(s as any).display_name || s.section_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">{role}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={pendingRoles[p.edipi] ?? role}
                                onChange={e => setPendingRoles(prev => ({ ...prev, [p.edipi]: e.target.value as any }))}
                                className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                              >
                                <option value="Section_Manager">Section Manager</option>
                                <option value="Member">Member</option>
                              </select>
                              <button
                                onClick={() => {
                                  const next = (pendingRoles[p.edipi] ?? role) as any
                                  setUserRoleOverride(p.edipi, next)
                                  setPendingRoles(prev => ({ ...prev, [p.edipi]: next }))
                                  ;(async () => {
                                    if (import.meta.env.VITE_USE_SUPABASE === '1') {
                                      const newCompany = pendingCompanyForEdipi[p.edipi]
                                      const newSectionKey = pendingSectionForEdipi[p.edipi]
                                      const sectionId = newSectionKey && /^\d+$/.test(newSectionKey) ? Number(newSectionKey) : undefined
                                      try {
                                        await sbUpdateUser(p.user_id, {
                                          company_id: newCompany || undefined,
                                          platoon_id: sectionId ? String(sectionId) : (newSectionKey || undefined),
                                          org_role: next,
                                        } as any)
                                        const updated = { ...p }
                                        if (newCompany !== undefined) updated.company_id = newCompany
                                        if (newSectionKey !== undefined) updated.platoon_id = newSectionKey as any
                                        updated.org_role = next
                                        setEdipiMap(prev => ({ ...prev, [p.edipi]: updated }))
                                      } catch {}
                                    }
                                  })()
                                }}
                                className="px-3 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setPendingRoles(prev => { const { [p.edipi]: _, ...rest } = prev; return rest })}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
