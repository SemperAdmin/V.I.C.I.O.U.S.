import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { listSubTasks, createSubTask, deleteSubTask, updateSubTask } from '@/utils/unitTasks'
import { listSections, createSection, deleteSection, listCompanies, createCompany, deleteCompany, updateSection, UnitSection, UnitCompany } from '@/utils/unitStructure'
import HeaderTools from '@/components/HeaderTools'
import { fetchJson, LocalUserProfile, UsersIndexEntry } from '@/services/localDataService'

export default function UnitAdminDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'structure' | 'tasks' | 'members'>('structure')
  const [sections, setSections] = useState<UnitSection[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [newSectionName, setNewSectionName] = useState('')
  const [newTask, setNewTask] = useState({ section_id: 0, sub_task_id: '', description: '', responsible_user_ids: '', location: '', instructions: '' })
  const unitId = user?.unit_id || ''
  const rucDisplay = unitId.includes('-') ? unitId.split('-')[1] : unitId
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
  const [taskEditingId, setTaskEditingId] = useState<number | null>(null)
  const [taskEditDescription, setTaskEditDescription] = useState('')
  const [taskEditLocation, setTaskEditLocation] = useState('')
  const [taskEditInstructions, setTaskEditInstructions] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [platoons, setPlatoons] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(user?.company_id)
  const [selectedPlatoon, setSelectedPlatoon] = useState<string | undefined>(user?.platoon_id)
  const [defaultEdipis, setDefaultEdipis] = useState<string[]>([])
  const [companiesError, setCompaniesError] = useState<string>('')

  useEffect(() => {
    if (!unitId) return
    const load = async () => {
      const secs = await listSections(unitId)
      setSections(secs)
      setSectionOptions(secs)
      const tsks = await listSubTasks(unitId)
      setTasks(tsks)
      const comps = await listCompanies(unitId)
      setCompanyRows(comps)
      const ids = comps.map(c => c.company_id)
      setCompanies(ids)
      if (!selectedCompany && ids.length) setSelectedCompany(ids[0])
    }
    load()
  }, [unitId])

  useEffect(() => {
    const filtered = selectedCompany ? sections.filter(s => (s as any).company_id === selectedCompany) : sections
    setSectionOptions(filtered)
  }, [sections, selectedCompany])

  useEffect(() => {
    if (!unitId) return
    const loadUsers = async () => {
      const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
      const profiles: LocalUserProfile[] = []
      for (const entry of index.users) {
        const profile = await fetchJson<LocalUserProfile>(`/${entry.path}`)
        if (profile.unit_id === unitId) profiles.push(profile)
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
  }, [unitId, selectedCompany, selectedPlatoon])

  if (!user || user.org_role !== 'Unit_Admin') {
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
              onClick={() => setTab('structure')}
              className={`px-4 py-3 text-sm ${tab === 'structure' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Unit Structure
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={`px-4 py-3 text-sm ${tab === 'tasks' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Tasks
            </button>
            <button
              onClick={() => setTab('members')}
              className={`px-4 py-3 text-sm ${tab === 'members' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Assigned Members
            </button>
          </div>
          
          <div className="p-6">
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
                          placeholder="Company id"
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
                    const filtered = selectedCompany ? secs.filter(s => (s as any).company_id === selectedCompany) : secs
                    setSectionOptions(filtered)
                    const defaultSectionId = filtered[0]?.id || 0
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
                                instructions: newTask.instructions.trim() || undefined
                              })
                              setTasks(await listSubTasks(unitId))
                              setCreateModalOpen(false)
                              setNewTask({ section_id: 0, sub_task_id: '', description: '', responsible_user_ids: '', location: '', instructions: '' })
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
                        <td className="p-2">{(t.responsible_user_ids || []).map(id => {
                          const u = edipiMap[id]
                          const rank = u?.rank || ''
                          const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ')
                          const disp = [rank, name].filter(Boolean).join(' ')
                          return disp || id
                        }).join(', ')}</td>
                        <td className="p-2 flex gap-2">
                          {taskEditingId === t.id ? (
                            <>
                              <button
                                onClick={async () => {
                                  await updateSubTask(t.id, {
                                    description: taskEditDescription.trim(),
                                    location: taskEditLocation.trim() || undefined,
                                    instructions: taskEditInstructions.trim() || undefined,
                                  })
                                  setTasks(await listSubTasks(unitId))
                                  setTaskEditingId(null)
                                  setTaskEditDescription('')
                                  setTaskEditLocation('')
                                  setTaskEditInstructions('')
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
            {tab === 'members' && (
              <div className="space-y-6">
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">EDIPI</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(edipiMap).filter(p => p.unit_id === unitId).map(p => {
                      const override = getRoleOverride(p.edipi)
                      const role = override?.org_role || p.org_role || 'Member'
                      const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
                      return (
                        <tr key={p.edipi} className="border-t border-github-border text-gray-300">
                          <td className="p-2">{p.edipi}</td>
                          <td className="p-2">{name}</td>
                          <td className="p-2">{role}</td>
                          <td className="p-2">
                            <select
                              defaultValue={role}
                              onChange={e => setUserRoleOverride(p.edipi, e.target.value as any)}
                              className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                            >
                              <option value="Unit_Admin">Unit Admin</option>
                              <option value="Section_Manager">Section Manager</option>
                              <option value="Member">Member</option>
                            </select>
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
