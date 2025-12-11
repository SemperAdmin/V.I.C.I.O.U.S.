import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { listSubTasks, createSubTask, deleteSubTask, updateSubTask } from '@/utils/unitTasks'
import { listForms, createForm, deleteForm, updateForm, UnitForm, UnitFormPurpose } from '@/utils/formsStore'
import { createSubmission } from '@/utils/myFormSubmissionsStore'
import { sbCreateSubmission } from '@/services/supabaseDataService'
import { listSections, createSection, deleteSection, listCompanies, createCompany, deleteCompany, updateSection, UnitSection, UnitCompany } from '@/utils/unitStructure'
import HeaderTools from '@/components/HeaderTools'
import { googleMapsLink } from '@/utils/maps'
import BrandMark from '@/components/BrandMark'
import { fetchJson, LocalUserProfile, UsersIndexEntry } from '@/services/localDataService'
import { getRoleOverride, setUserRoleOverride } from '@/utils/localUsersStore'
import { UNITS } from '@/utils/units'
import { getAssignedUnitsForRuc, setAssignedUnitsForRuc } from '@/utils/adminScopeStore'
import { sbListUnitAdmins, sbUpsertUnitAdmin, sbRemoveUnitAdmin, sbGetAdminRucs } from '@/services/adminService'
import { getUnitAdmins, addUnitAdmin, removeUnitAdmin } from '@/utils/unitAdminsStore'
import { sbListUsersByRuc, sbUpdateUser } from '@/services/supabaseDataService'
import { QRCodeSVG } from 'qrcode.react'

export default function UnitAdminDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'structure' | 'tasks' | 'members' | 'forms' | 'assign'>('structure')
  const [sections, setSections] = useState<UnitSection[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [forms, setForms] = useState<UnitForm[]>([])
  const [newSectionName, setNewSectionName] = useState('')
  const [newTask, setNewTask] = useState({ section_id: 0, sub_task_id: '', description: '', responsible_user_ids: '', location: '', instructions: '' })
  const [adminRucs, setAdminRucs] = useState<Array<{ ruc: string }>>([])
  const getInitialRuc = () => {
    const stored = localStorage.getItem('selectedAdminRuc')
    if (stored) return stored
    return (user?.unit_id || '').includes('-') ? (user?.unit_id || '').split('-')[1] : (user?.unit_id || '')
  }
  const [managedRuc, setManagedRuc] = useState(getInitialRuc())
  const [rucSwitching, setRucSwitching] = useState(false)
  const unitId = managedRuc
  const rucDisplay = managedRuc

  // Function to clear all RUC-specific state when switching
  const clearRucState = () => {
    setSections([])
    setTasks([])
    setForms([])
    setCompanies([])
    setCompanyRows([])
    setSectionOptions([])
    setEdipiMap({})
    setAssignedUnits([])
    setSelectedCompany(undefined)
    setSelectedPlatoon(undefined)
    setDefaultEdipis([])
    setPlatoons([])
  }

  // Handler for RUC switching with proper state isolation
  const handleRucSwitch = async (newRuc: string) => {
    if (newRuc === managedRuc) return

    // Start switching - show loading state
    setRucSwitching(true)

    // Clear all RUC-specific state to prevent data crossing
    clearRucState()

    // Update the managed RUC
    setManagedRuc(newRuc)
    localStorage.setItem('selectedAdminRuc', newRuc)

    // Loading state will be cleared by the useEffect when data loads
  }
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
  const [taskEditLocationUrl, setTaskEditLocationUrl] = useState('')
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
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrForm, setQrForm] = useState<UnitForm | null>(null)
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
  const [adminsLoading, setAdminsLoading] = useState(true)
  const [pendingRoles, setPendingRoles] = useState<Record<string, 'Section_Manager' | 'Member'>>({})
  const [pendingCompanyForEdipi, setPendingCompanyForEdipi] = useState<Record<string, string>>({})
  const [pendingSectionForEdipi, setPendingSectionForEdipi] = useState<Record<string, string>>({})
  const [editMemberEdipi, setEditMemberEdipi] = useState<string | null>(null)
  const [editMemberCompany, setEditMemberCompany] = useState<string>('')
  const [editMemberSection, setEditMemberSection] = useState<string>('')
  const [editMemberRole, setEditMemberRole] = useState<'Section_Manager' | 'Member'>('Member')

  useEffect(() => {
    const items = UNITS.filter(u => String(u.ruc) === managedRuc)
      .map(u => ({ id: `${u.uic}-${u.ruc}-${u.mcc}`, name: u.unitName, uic: u.uic, ruc: u.ruc, mcc: u.mcc }))
    setUnitsForRuc(items)
    const preset = getAssignedUnitsForRuc(user?.edipi || '', managedRuc)
    const own = (user?.unit_id || '')
    const next = Array.from(new Set([...preset, own].filter(Boolean)))
    setAssignedUnits(next)
    setAssignedUnitsForRuc(user?.edipi || '', managedRuc, next)
    if (!unitId) {
      setRucSwitching(false)
      return
    }
    const load = async () => {
      try {
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
      } finally {
        // Clear switching state when data loading completes
        setRucSwitching(false)
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
        // Fetch RUCs this admin has access to
        if (user?.edipi) {
          const rucs = await sbGetAdminRucs(user.edipi)
          setAdminRucs(rucs)

          const storedRuc = localStorage.getItem('selectedAdminRuc')
          const rucList = rucs.map(r => r.ruc)

          // Validate stored RUC is still accessible to this admin
          if (storedRuc && !rucList.includes(storedRuc) && rucs.length > 0) {
            // Stored RUC is no longer valid for this admin, switch to first available
            const defaultRuc = rucs[0].ruc
            setManagedRuc(defaultRuc)
            localStorage.setItem('selectedAdminRuc', defaultRuc)
          } else if (!storedRuc && rucs.length > 0 && !managedRuc) {
            // No stored RUC preference and user has RUCs, default to first one
            const defaultRuc = rucs[0].ruc
            setManagedRuc(defaultRuc)
            localStorage.setItem('selectedAdminRuc', defaultRuc)
          }
        }
      } catch {
        setGlobalAdmins([])
        setAdminRucs([])
      }
      setAdminsLoading(false)
    })()
  }, [])

  useEffect(() => {
    const filtered = selectedCompany ? sections.filter(s => s.company_id === selectedCompany) : sections
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
  const isAssignedAdmin = !!globalAdmins.find(a => a.admin_user_id === (user?.edipi || ''))
  const isAppAdmin = !!(user?.is_app_admin || user?.org_role === ('App_Admin' as any))
  if (!user) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Access denied</p>
      </div>
    )
  }
  if (adminsLoading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Loading admin assignments…</p>
      </div>
    )
  }
  if (!isAppAdmin && !isAssignedAdmin) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Access denied — not assigned as Unit Admin</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <header className="bg-github-gray bg-opacity-10 border-b border-github-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <BrandMark />
            <HeaderTools />
          </div>
        </div>
      </header>
      {adminRucs.length > 0 && (
        <div className="bg-github-gray bg-opacity-5 border-b border-github-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Managing RUC:</label>
              {adminRucs.length === 1 ? (
                <span className="text-white text-sm font-semibold">{adminRucs[0].ruc}</span>
              ) : (
                <select
                  value={managedRuc}
                  onChange={(e) => handleRucSwitch(e.target.value)}
                  disabled={rucSwitching}
                  className="bg-semper-navy bg-opacity-80 border border-gray-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-semper-gold disabled:opacity-50"
                >
                  {adminRucs.map((ruc) => (
                    <option key={ruc.ruc} value={ruc.ruc}>
                      {ruc.ruc}
                    </option>
                  ))}
                </select>
              )}
              {rucSwitching && (
                <span className="text-gray-400 text-sm animate-pulse">Loading...</span>
              )}
              <span className="hidden sm:inline text-gray-400 text-xs">Use tabs below to manage all units under this RUC</span>
            </div>
          </div>
        </div>
      )}
      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl relative">
          {rucSwitching && (
            <div className="absolute inset-0 bg-github-dark bg-opacity-80 flex items-center justify-center z-10 rounded-xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-blue mx-auto mb-2"></div>
                <p className="text-gray-300">Loading RUC {managedRuc} data...</p>
              </div>
            </div>
          )}
          <div className="flex overflow-x-auto border-b border-github-border scrollbar-hide">
            <button
              onClick={() => setTab('members')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'members' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Members
            </button>
            <button
              onClick={() => setTab('forms')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'forms' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Forms
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'tasks' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Tasks
            </button>
            <button
              onClick={() => setTab('assign')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'assign' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Units
            </button>
            <button
              onClick={() => setTab('structure')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'structure' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Structure
            </button>
          </div>
          
          <div className="p-3 sm:p-6">
            {tab === 'assign' && (
              <div className="space-y-4">
                <div className="text-gray-300">Assign units under RUC {rucDisplay} to manage</div>
                <div className="flex overflow-x-auto border-b border-github-border">
                  <button
                    onClick={() => setAssignTab('assigned')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap ${assignTab === 'assigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
                  >
                    Assigned
                  </button>
                  <button
                    onClick={() => setAssignTab('unassigned')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap ${assignTab === 'unassigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
                  >
                    Unassigned
                  </button>
                </div>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
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
              </div>
            )}
            {tab === 'structure' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  
                  {companies.length === 0 && (
                    <div className="text-yellow-400 text-sm">No companies available. Create one below.</div>
                  )}
                </div>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
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
                          className="w-full min-w-[80px] px-2 sm:px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={newSectionName}
                          onChange={e => setNewSectionName(e.target.value)}
                          placeholder="Code"
                          className="w-full min-w-[80px] px-2 sm:px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={newSectionDisplay}
                          onChange={e => setNewSectionDisplay(e.target.value)}
                          placeholder="Name"
                          className="w-full min-w-[80px] px-2 sm:px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm"
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
                          className="px-2 sm:px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-xs sm:text-sm whitespace-nowrap"
                        >
                          Create
                        </button>
                      </td>
                    </tr>
                    {sections.map(s => (
                      <tr key={s.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">
                          {editingId === s.id ? (
                            <input value={editCompanyId} onChange={e => setEditCompanyId(e.target.value)} className="w-full min-w-[60px] px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm" />
                          ) : (
                            (s as any).company_id || ''
                          )}
                        </td>
                        <td className="p-2">
                          {editingId === s.id ? (
                            <input value={editSectionCode} onChange={e => setEditSectionCode(e.target.value)} className="w-full min-w-[60px] px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm" />
                          ) : (
                            s.section_name
                          )}
                        </td>
                        <td className="p-2">
                          {editingId === s.id ? (
                            <input value={editDisplay} onChange={e => setEditDisplay(e.target.value)} className="w-full min-w-[60px] px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm" />
                          ) : (
                            (s as any).display_name || ''
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1 sm:gap-2">
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
                                className="px-2 sm:px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs sm:text-sm"
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
                                className="px-2 sm:px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs sm:text-sm"
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
                                className="px-2 sm:px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs sm:text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  await deleteSection(s.id)
                                  setSections(await listSections(unitId))
                                }}
                                className="px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs sm:text-sm"
                              >
                                Del
                              </button>
                            </>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {companiesError && (
                  <div className="text-red-400 text-sm">{companiesError}</div>
                )}
              </div>
            )}
            {tab === 'tasks' && (
              <div className="space-y-4 sm:space-y-6">
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
                  className="px-3 sm:px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-sm"
                >
                  + New Task
                </button>
                {tasksError && (
                  <div className="text-red-400 text-sm">{tasksError}</div>
                )}
                {createModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
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
                          {sections.map(s => (
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
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2 whitespace-nowrap">Section</th>
                      <th className="text-left p-2 whitespace-nowrap">Description</th>
                      <th className="text-left p-2 whitespace-nowrap hidden sm:table-cell">Location</th>
                      <th className="text-left p-2 whitespace-nowrap hidden md:table-cell">Instructions</th>
                      <th className="text-left p-2 whitespace-nowrap hidden lg:table-cell">Responsible</th>
                      <th className="text-left p-2 whitespace-nowrap hidden sm:table-cell">Completion</th>
                      <th className="text-left p-2 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2 whitespace-nowrap">{(() => {
                          const sec = sections.find(s => s.id === t.section_id)
                          return (sec as any)?.display_name || sec?.section_name || ''
                        })()}</td>
                        <td className="p-2 max-w-[150px] sm:max-w-none truncate sm:whitespace-normal">{taskEditingId === t.id ? (
                          <input value={taskEditDescription} onChange={e => setTaskEditDescription(e.target.value)} className="w-full min-w-[100px] px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs sm:text-sm" />
                        ) : (t.description)}</td>
                        <td className="p-2 hidden sm:table-cell">{taskEditingId === t.id ? (
                          <div className="grid grid-cols-1 gap-1">
                            <input value={taskEditLocation} onChange={e => setTaskEditLocation(e.target.value)} placeholder="Location" className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs" />
                            <input value={taskEditLocationUrl} onChange={e => setTaskEditLocationUrl(e.target.value)} placeholder="Map URL" className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs" />
                          </div>
                        ) : ((t as any).map_url || t.location ? (
                          <a href={((t as any).map_url || googleMapsLink(t.location || ''))} target="_blank" rel="noopener noreferrer" className="text-semper-gold hover:underline">{t.location || 'Map'}</a>
                        ) : '')}</td>
                        <td className="p-2 hidden md:table-cell max-w-[150px] truncate">{taskEditingId === t.id ? (
                          <input value={taskEditInstructions} onChange={e => setTaskEditInstructions(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs" />
                        ) : (t.instructions || '')}</td>
                        <td className="p-2 hidden lg:table-cell">{(t.responsible_user_ids || []).map((id: string) => {
                          const u = edipiMap[id]
                          const rank = u?.rank || ''
                          const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ')
                          const disp = [rank, name].filter(Boolean).join(' ')
                          return disp || id
                        }).join(', ')}</td>
                        <td className="p-2 hidden sm:table-cell">{taskEditingId === t.id ? (
                          <div className="grid grid-cols-1 gap-1">
                            <select value={taskEditCompletionKind} onChange={e => setTaskEditCompletionKind(e.target.value as any)} className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs">
                              <option value="">Type</option>
                              <option value="Text">Text</option>
                              <option value="Date">Date</option>
                              <option value="Options">Options</option>
                            </select>
                            <input value={taskEditCompletionLabel} onChange={e => setTaskEditCompletionLabel(e.target.value)} placeholder="Label" className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs" />
                            {taskEditCompletionKind === 'Options' && (
                              <input value={taskEditCompletionOptions} onChange={e => setTaskEditCompletionOptions(e.target.value)} placeholder="Options" className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs" />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs">{[t.completion_kind, t.completion_label].filter(Boolean).join(': ')}</span>
                        )}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                          {taskEditingId === t.id ? (
                            <>
                              <button
                                onClick={async () => {
                                  await updateSubTask(t.id, {
                                    description: taskEditDescription.trim(),
                                    location: taskEditLocation.trim() || undefined,
                                    map_url: taskEditLocationUrl.trim() || undefined,
                                    instructions: taskEditInstructions.trim() || undefined,
                                    completion_kind: taskEditCompletionKind || undefined,
                                    completion_label: taskEditCompletionLabel.trim() || undefined,
                                    completion_options: taskEditCompletionKind === 'Options' ? taskEditCompletionOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                                  })
                                  setTasks(await listSubTasks(unitId))
                                  setTaskEditingId(null)
                                  setTaskEditDescription('')
                                  setTaskEditLocation('')
                                  setTaskEditLocationUrl('')
                                  setTaskEditInstructions('')
                                  setTaskEditCompletionKind('')
                                  setTaskEditCompletionLabel('')
                                  setTaskEditCompletionOptions('')
                                }}
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setTaskEditingId(null)
                                  setTaskEditDescription('')
                                  setTaskEditLocation('')
                                  setTaskEditLocationUrl('')
                                  setTaskEditInstructions('')
                                }}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                              >
                                X
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setTaskEditingId(t.id)
                                  setTaskEditDescription(t.description || '')
                                  setTaskEditLocation(t.location || '')
                                  setTaskEditLocationUrl((t as any).map_url || '')
                                  setTaskEditInstructions(t.instructions || '')
                                  setTaskEditCompletionKind(t.completion_kind || '')
                                  setTaskEditCompletionLabel(t.completion_label || '')
                                  setTaskEditCompletionOptions((t.completion_options || []).join(', '))
                                }}
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  await deleteSubTask(t.id)
                                  setTasks(await listSubTasks(unitId))
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                              >
                                Del
                              </button>
                            </>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
            {tab === 'forms' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="text-gray-300 text-sm sm:text-base">Create inbound/outbound requirements</div>
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
                    className="px-3 sm:px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-sm whitespace-nowrap"
                  >
                    + New Form
                  </button>
                </div>

                {createModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
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
                                try {
                                  const all = await listForms(unitId)
                                  const just = all.find(f => f.name === newFormName.trim() && f.kind === newFormKind)
                                  if (just) {
                                    for (const ed of defaultEdipis) {
                                      const p = edipiMap[ed]
                                      if (!p) continue
                                      const tasks = (just.task_ids || []).map(tid => ({ sub_task_id: tid, description: String(tid), status: 'Pending' as const }))
                                      const payload = {
                                        user_id: p.user_id,
                                        unit_id: p.unit_id,
                                        form_id: just.id,
                                        form_name: just.name,
                                        kind: just.kind,
                                        member: { edipi: p.edipi, rank: p.rank, first_name: p.first_name, last_name: p.last_name, company_id: p.company_id, platoon_id: p.platoon_id },
                                        tasks,
                                        task_ids: just.task_ids,
                                        completed_count: 0,
                                        total_count: (just.task_ids || []).length,
                                        status: 'In_Progress' as const,
                                        arrival_date: just.kind === 'Inbound' ? new Date().toISOString().slice(0,10) : undefined,
                                        departure_date: just.kind === 'Outbound' ? new Date().toISOString().slice(0,10) : undefined,
                                      }
                                      try {
                                        if (import.meta.env.VITE_USE_SUPABASE === '1') {
                                          await sbCreateSubmission(payload as any)
                                        } else {
                                          await createSubmission(payload as any)
                                        }
                                      } catch {}
                                    }
                                  }
                                } catch {}
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

                <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2 hidden sm:table-cell">Purpose</th>
                      <th className="text-left p-2">Tasks</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map(f => (
                      <tr key={f.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">{f.name}</td>
                        <td className="p-2 whitespace-nowrap">{f.kind}</td>
                        <td className="p-2 hidden sm:table-cell">{(() => {
                          switch (f.purpose) {
                            case 'Fleet_Assistance_Program': return 'FAP'
                            case 'TAD_31_plus_days': return 'TAD 31+'
                            case 'TAD_30_or_less': return 'TAD ≤30'
                            case 'PCA': return 'PCA'
                            case 'PCS': return 'PCS'
                            case 'Separation': return 'Sep'
                            case 'Retirement': return 'Ret'
                            default: return ''
                          }
                        })()}</td>
                        <td className="p-2 text-center">{f.task_ids.length}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
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
                            className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setQrForm(f)
                              setQrModalOpen(true)
                            }}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                          >
                            QR
                          </button>
                          <button
                            onClick={async () => {
                              await deleteForm(unitId, f.id)
                              setForms(await listForms(unitId))
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                          >
                            Del
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {formsError && (
                  <div className="text-red-400 text-sm">{formsError}</div>
                )}
              </div>
            )}
            {tab === 'members' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Member</th>
                      <th className="text-left p-2 hidden sm:table-cell">Company</th>
                      <th className="text-left p-2 hidden sm:table-cell">Section</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Action</th>
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
                          <td className="p-2">
                            <div>{[p.rank, name].filter(Boolean).join(' ')}</div>
                            <div className="text-xs text-gray-500 sm:hidden">{[company, sectionLabel].filter(Boolean).join(' • ')}</div>
                          </td>
                          <td className="p-2 hidden sm:table-cell">{company || ''}</td>
                          <td className="p-2 hidden sm:table-cell">{sectionLabel}</td>
                          <td className="p-2 whitespace-nowrap">{role === 'Section_Manager' ? 'Sec Mgr' : role}</td>
                          <td className="p-2">
                            <button
                              onClick={() => {
                                setEditMemberEdipi(p.edipi)
                                setEditMemberCompany(p.company_id || '')
                                setEditMemberSection(String(p.platoon_id || ''))
                                setEditMemberRole((role as any) || 'Member')
                              }}
                              className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                {editMemberEdipi && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                      <h3 className="text-white text-lg mb-4">Update Member</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <select
                          value={editMemberCompany}
                          onChange={e => setEditMemberCompany(e.target.value)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="">Select company</option>
                          {companies.map(cid => (
                            <option key={cid} value={cid}>{cid}</option>
                          ))}
                        </select>
                        <select
                          value={editMemberSection}
                          onChange={e => setEditMemberSection(e.target.value)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="">Select section</option>
                          {sections.map(s => (
                            <option key={s.id} value={String(s.id)}>{(s as any).display_name || s.section_name}</option>
                          ))}
                        </select>
                        <select
                          value={editMemberRole}
                          onChange={e => setEditMemberRole(e.target.value as any)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="Section_Manager">Section Manager</option>
                          <option value="Member">Member</option>
                        </select>
                      </div>
                      <div className="mt-6 flex gap-2 justify-end">
                        <button
                          onClick={async () => {
                            const p = edipiMap[editMemberEdipi!]
                            if (!p) { setEditMemberEdipi(null); return }
                          try {
                            if (import.meta.env.VITE_USE_SUPABASE === '1') {
                              const sectionId = editMemberSection && /^\d+$/.test(editMemberSection) ? Number(editMemberSection) : undefined
                              await sbUpdateUser(p.user_id, {
                                company_id: editMemberCompany || undefined,
                                platoon_id: sectionId ? String(sectionId) : (editMemberSection || undefined),
                                org_role: editMemberRole,
                              })
                            }
                            const updated = { ...p, company_id: editMemberCompany || p.company_id, platoon_id: editMemberSection || (p.platoon_id as any), org_role: editMemberRole }
                            setEdipiMap(prev => ({ ...prev, [p.edipi]: updated }))
                            setEditMemberEdipi(null)
                          } catch (error) {
                            console.error('Failed to update user:', error)
                            alert('Failed to save changes. Please try again.')
                            setEditMemberEdipi(null)
                          }
                          }}
                          className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditMemberEdipi(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* QR Code Modal */}
      {qrModalOpen && qrForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-black border border-github-border rounded-xl p-6">
            <h3 className="text-white text-lg mb-4">QR Code for {qrForm.name}</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg qr-modal-svg">
                <QRCodeSVG
                  value={`${window.location.origin}${import.meta.env.BASE_URL}enroll?form=${qrForm.id}&unit=${unitId}&kind=${qrForm.kind}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-center text-gray-400 text-sm">
                <p className="mb-2">Scan to start <span className="text-white">{qrForm.kind}</span> process</p>
                <p className="text-xs break-all">{qrForm.kind} • {qrForm.task_ids.length} tasks</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}${import.meta.env.BASE_URL}enroll?form=${qrForm.id}&unit=${unitId}&kind=${qrForm.kind}`
                    navigator.clipboard.writeText(url)
                    alert('Link copied to clipboard!')
                  }}
                  className="flex-1 px-4 py-2 bg-github-gray bg-opacity-40 hover:bg-opacity-60 border border-github-border text-white rounded"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    const svg = document.querySelector('.qr-modal-svg svg')
                    if (!svg) return
                    const svgData = new XMLSerializer().serializeToString(svg)
                    const canvas = document.createElement('canvas')
                    const ctx = canvas.getContext('2d')
                    const img = new Image()
                    img.onload = () => {
                      canvas.width = img.width
                      canvas.height = img.height
                      ctx?.drawImage(img, 0, 0)
                      const a = document.createElement('a')
                      a.download = `${qrForm.name.replace(/\s+/g, '_')}_QR.png`
                      a.href = canvas.toDataURL('image/png')
                      a.click()
                    }
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
                  }}
                  className="flex-1 px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                >
                  Download
                </button>
              </div>
              <button
                onClick={() => { setQrModalOpen(false); setQrForm(null) }}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
