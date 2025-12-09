import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import HeaderTools from '@/components/HeaderTools'
import { fetchJson, LocalUserProfile, UsersIndexEntry, getChecklistByUnit, listMembers, getProgressByMember } from '@/services/localDataService'
import { sbListUsers } from '@/services/supabaseDataService'
import { listSections } from '@/utils/unitStructure'
import { listSubTasks, createSubTask, updateSubTask, deleteSubTask, UnitSubTask } from '@/utils/unitTasks'
import { sbUpsertProgress } from '@/services/supabaseDataService'
import { canonicalize } from '@/utils/json'
import { sha256String } from '@/utils/crypto'
import { listForms } from '@/utils/formsStore'

export default function TaskManagerDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'inbound' | 'outbound' | 'tasks'>('inbound')
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [taskLabels, setTaskLabels] = useState<Record<string, { section_name: string; description: string }>>({})
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  const [inboundGroups, setInboundGroups] = useState<Record<string, string[]>>({})
  const [outboundGroups, setOutboundGroups] = useState<Record<string, string[]>>({})
  const [sectionLabel, setSectionLabel] = useState('')
  const [scopedTasks, setScopedTasks] = useState<Array<{ section: string; description: string; location?: string; instructions?: string; responsible: string }>>([])
  const [scopedSubTasks, setScopedSubTasks] = useState<UnitSubTask[]>([])
  const [mySectionId, setMySectionId] = useState<number | null>(null)
  const [sectionPrefix, setSectionPrefix] = useState('')
  const [defaultResponsible, setDefaultResponsible] = useState<string[]>([])
  const [taskEditingId, setTaskEditingId] = useState<number | null>(null)
  const [taskEditDescription, setTaskEditDescription] = useState('')
  const [taskEditLocation, setTaskEditLocation] = useState('')
  const [taskEditInstructions, setTaskEditInstructions] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!user || !user.unit_id) return
    const load = async () => {
      const unitKey = (user.unit_id || '').includes('-') ? (user.unit_id as string).split('-')[1] : (user.unit_id as string)
      const profiles: Record<string, LocalUserProfile> = {}
      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        try {
          const allUsers = await sbListUsers()
          for (const profile of allUsers) {
            profiles[profile.user_id] = profile
          }
        } catch {
        }
      }
      if (Object.keys(profiles).length === 0) {
        try {
          const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
          for (const entry of index.users) {
            const profile = await fetchJson<LocalUserProfile>(`/${entry.path}`)
            profiles[profile.user_id] = profile
          }
        } catch {
        }
      }
      setMemberMap(profiles)

      const checklist = await getChecklistByUnit(user.unit_id)
      const labels: Record<string, { section_name: string; description: string }> = {}
      for (const sec of checklist.sections) {
        for (const st of sec.sub_tasks) {
          labels[st.sub_task_id] = { section_name: sec.section_name, description: st.description }
        }
      }
      setTaskLabels(labels)

      const members = await listMembers()
      // Build section display name map (code -> display)
      const displayMap: Record<string, string> = {}
      try {
        const allSecs = await listSections(unitKey)
        for (const s of allSecs) {
          displayMap[s.section_name] = ((s as any).display_name || s.section_name)
        }
      } catch {}
      setSectionDisplayMap(displayMap)
      // Resolve user's section and load tasks from Supabase unit_sub_tasks
      let sectionTaskIds = new Set<string>()
      try {
        const secs = await listSections(unitKey)
        const byId = secs.find(s => String(s.id) === String(user.platoon_id))
        const byCode = secs.find(s => s.section_name === user.platoon_id)
        const byDisplay = secs.find(s => (s as any).display_name === user.platoon_id)
        const sec = byId || byCode || byDisplay || null
        const secId = sec ? sec.id : null
        const secCode = sec ? sec.section_name : (user.platoon_id as string)
        const secDisplay = sec ? ((sec as any).display_name || '') : ''
        const subTasks = await listSubTasks(unitKey)
        for (const t of subTasks) {
          const matchesSectionId = secId ? String(t.section_id) === String(secId) : false
          const matchesCode = secCode ? String(t.sub_task_id || '').startsWith(`${secCode}-`) : false
          const matchesDisplayCode = secDisplay ? String(t.sub_task_id || '').startsWith(`${secDisplay}-`) : false
          if (matchesSectionId || matchesCode || matchesDisplayCode) {
            sectionTaskIds.add(t.sub_task_id)
          }
        }
      } catch {}
      // Determine form-kind task id sets
      const ruc = (user.unit_id || '').includes('-') ? (user.unit_id || '').split('-')[1] : (user.unit_id || '')
      let inboundTaskIds = new Set<string>()
      let outboundTaskIds = new Set<string>()
      try {
        const forms = await listForms(ruc)
        inboundTaskIds = new Set(forms.filter(f => f.kind === 'Inbound').flatMap(f => f.task_ids))
        outboundTaskIds = new Set(forms.filter(f => f.kind === 'Outbound').flatMap(f => f.task_ids))
      } catch {}
      // Fallback: if form sets are empty, use all section tasks to populate UI so managers see data
      if (inboundTaskIds.size === 0) inboundTaskIds = new Set(sectionTaskIds)
      if (outboundTaskIds.size === 0) outboundTaskIds = new Set(sectionTaskIds)
      const sectionMembers = Object.values(profiles).filter(p => p.unit_id === user.unit_id && (!!user.platoon_id ? String(p.platoon_id) === String(user.platoon_id) : true))
      const sectionEdipis = new Set(sectionMembers.map(p => p.edipi))
      setDefaultResponsible(Array.from(sectionEdipis))

      const responsibleSet = new Set<string>()
      for (const sec of checklist.sections) {
        for (const st of sec.sub_tasks) {
          if ((st.responsible_user_id || []).length === 0 || st.responsible_user_id.some(id => sectionEdipis.has(id))) {
            responsibleSet.add(st.sub_task_id)
          }
        }
      }

      const inboundByTask: Record<string, Set<string>> = {}
      const outboundByTask: Record<string, Set<string>> = {}
      for (const m of members.filter(m => m.unit_id === user.unit_id)) {
        const progress = await getProgressByMember(m.member_user_id)
        if (import.meta.env.VITE_USE_SUPABASE === '1' && (progress.progress_tasks || []).length === 0) {
          const toSeed = Array.from(sectionTaskIds)
          if (toSeed.length) {
            const seeded = {
              member_user_id: m.member_user_id,
              unit_id: user.unit_id,
              official_checkin_timestamp: progress.official_checkin_timestamp || new Date().toISOString(),
              current_file_sha: '',
              progress_tasks: toSeed.map(id => ({ sub_task_id: id, status: 'Pending' as const })),
            }
            const canon = canonicalize(seeded)
            const sha = await sha256String(canon)
            seeded.current_file_sha = sha
            try { await sbUpsertProgress(seeded as any) } catch {}
          }
        }
        for (const t of progress.progress_tasks) {
          if (responsibleSet.has(t.sub_task_id)) {
            const subId = t.sub_task_id
            if (t.status === 'Pending') {
              if (sectionTaskIds.has(subId) && inboundTaskIds.has(subId)) {
                if (!inboundByTask[subId]) inboundByTask[subId] = new Set()
                inboundByTask[subId].add(m.member_user_id)
              }
              if (sectionTaskIds.has(subId) && outboundTaskIds.has(subId)) {
                if (!outboundByTask[subId]) outboundByTask[subId] = new Set()
                outboundByTask[subId].add(m.member_user_id)
              }
            }
          }
        }
      }
      setInboundGroups(Object.fromEntries(Object.entries(inboundByTask).map(([k, v]) => [k, Array.from(v)])))
      setOutboundGroups(Object.fromEntries(Object.entries(outboundByTask).map(([k, v]) => [k, Array.from(v)])))

      // Build scoped tasks list similar to Unit Admin tasks table, but filtered to user's section
      let userSectionId: number | null = null
      let userSectionCode: string | null = null
      let userSectionDisplay: string | null = null
      try {
        const secs = await listSections(unitKey)
        const byId = secs.find(s => String(s.id) === String(user.platoon_id))
        const byCode = secs.find(s => s.section_name === user.platoon_id)
        const byDisplay = secs.find(s => (s as any).display_name === user.platoon_id)
        const sec = byId || byCode || byDisplay || null
        userSectionId = sec ? sec.id : null
        userSectionCode = sec ? sec.section_name : null
        userSectionDisplay = sec ? ((sec as any).display_name || sec.section_name) : null
      } catch {
        userSectionId = null
        userSectionCode = null
        userSectionDisplay = null
      }
      setMySectionId(userSectionId)
      setSectionPrefix(userSectionDisplay || userSectionCode || '')
      const subTasks = await listSubTasks(unitKey)
      const filtered = subTasks.filter(t => {
        const matchesSectionId = userSectionId ? String(t.section_id) === String(userSectionId) : false
        const matchesCode = userSectionCode ? String(t.sub_task_id || '').startsWith(`${userSectionCode}-`) : false
        const matchesDisplayCode = userSectionDisplay ? String(t.sub_task_id || '').startsWith(`${userSectionDisplay}-`) : false
        const matchesResponsible = t.responsible_user_ids.some(id => sectionEdipis.has(id))
        return matchesSectionId || matchesCode || matchesDisplayCode || matchesResponsible
      })
      const scoped = filtered.map(t => {
        const secName = userSectionDisplay || userSectionCode || sectionLabel || ''
        const responsibleLabels = t.responsible_user_ids.map(ed => {
          const p = profiles[ed]
          const name = p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : ed
          return name
        }).join(', ')
        return { section: secName, description: t.description, location: t.location, instructions: t.instructions, responsible: responsibleLabels }
      })
      setScopedTasks(scoped)
      setScopedSubTasks(filtered)
    }
    load()
  }, [user])

  useEffect(() => {
    const resolveSection = async () => {
      const uid = user?.unit_id
      const secId = user?.platoon_id
      if (!uid || !secId) { setSectionLabel(''); return }
      try {
        const secs = await listSections(uid)
        const byId = secs.find(s => String(s.id) === String(secId))
        if (byId) { setSectionLabel(((byId as any).display_name || byId.section_name) || ''); return }
        const byCode = secs.find(s => s.section_name === secId)
        setSectionLabel(((byCode as any)?.display_name || byCode?.section_name) || '')
      } catch { setSectionLabel('') }
    }
    resolveSection()
  }, [user?.unit_id, user?.platoon_id])

  if (!user) {
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
            <h1 className="text-xl font-semibold text-white">Task Manager - {sectionLabel || 'Section'}</h1>
            <HeaderTools />
          </div>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl">
          <div className="flex border-b border-github-border">
            <button
              onClick={() => setTab('inbound')}
              className={`px-4 py-3 text-sm ${tab === 'inbound' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Inbound
            </button>
            <button
              onClick={() => setTab('outbound')}
              className={`px-4 py-3 text-sm ${tab === 'outbound' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Outbound
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={`px-4 py-3 text-sm ${tab === 'tasks' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Tasks
            </button>
          </div>
          <div className="p-6 space-y-6">
            {tab === 'inbound' && (
              <div className="space-y-6">
                {Object.entries(inboundGroups).map(([subTaskId, members]) => {
                  const label = taskLabels[subTaskId]
                  const secCode = label?.section_name || ''
                  const secDisplay = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                  const title = `${secDisplay} - ${label?.description || subTaskId}`
                  return (
                    <div key={subTaskId} className="border border-github-border rounded-xl">
                      <div className="px-4 py-3 border-b border-github-border">
                        <h3 className="text-white text-sm">{title}</h3>
                      </div>
                      <div className="p-4">
                        <table className="min-w-full text-sm">
                          <thead className="text-gray-400">
                            <tr>
                              <th className="text-left p-2">Member</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map(mid => {
                              const m = memberMap[mid]
                              const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : mid
                              return (
                                <tr key={`${subTaskId}-${mid}`} className="border-t border-github-border text-gray-300">
                                  <td className="p-2">{name}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'outbound' && (
              <div className="space-y-6">
                {Object.entries(outboundGroups).map(([subTaskId, members]) => {
                  const label = taskLabels[subTaskId]
                  const secCode = label?.section_name || ''
                  const secDisplay = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                  const title = `${secDisplay} - ${label?.description || subTaskId}`
                  return (
                    <div key={subTaskId} className="border border-github-border rounded-xl">
                      <div className="px-4 py-3 border-b border-github-border">
                        <h3 className="text-white text-sm">{title}</h3>
                      </div>
                      <div className="p-4">
                        <table className="min-w-full text-sm">
                          <thead className="text-gray-400">
                            <tr>
                              <th className="text-left p-2">Member</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map(mid => {
                              const m = memberMap[mid]
                              const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : mid
                              return (
                                <tr key={`${subTaskId}-${mid}`} className="border-t border-github-border text-gray-300">
                                  <td className="p-2">{name}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'tasks' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-gray-300">Manage section tasks</div>
                  <button onClick={() => { setErrorMsg(''); setNewDescription(''); setNewLocation(''); setNewInstructions(''); setCreateOpen(true) }} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Create Task</button>
                </div>
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
                    {scopedSubTasks.map(t => (
                      <tr key={t.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">{sectionPrefix}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditDescription} onChange={e => setTaskEditDescription(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.description)}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditLocation} onChange={e => setTaskEditLocation(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.location || '')}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditInstructions} onChange={e => setTaskEditInstructions(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.instructions || '')}</td>
                        <td className="p-2">{t.responsible_user_ids.join(', ')}</td>
                        <td className="p-2 flex gap-2">
                          {taskEditingId === t.id ? (
                            <>
                              <button onClick={async () => {
                                await updateSubTask(t.id, { description: taskEditDescription.trim(), location: taskEditLocation.trim() || undefined, instructions: taskEditInstructions.trim() || undefined })
                                setTaskEditingId(null)
                                setTaskEditDescription('')
                                setTaskEditLocation('')
                                setTaskEditInstructions('')
                                const unitKey = (user!.unit_id || '').includes('-') ? (user!.unit_id as string).split('-')[1] : (user!.unit_id as string)
                                const refreshed = await listSubTasks(unitKey)
                                setScopedSubTasks(refreshed.filter(x => String(x.section_id) === String(mySectionId)))
                              }} className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
                              <button onClick={() => { setTaskEditingId(null); setTaskEditDescription(''); setTaskEditLocation(''); setTaskEditInstructions('') }} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setTaskEditingId(t.id); setTaskEditDescription(t.description || ''); setTaskEditLocation(t.location || ''); setTaskEditInstructions(t.instructions || '') }} className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded">Edit</button>
                              <button onClick={async () => { await deleteSubTask(t.id); const unitKey = (user!.unit_id || '').includes('-') ? (user!.unit_id as string).split('-')[1] : (user!.unit_id as string); const refreshed = await listSubTasks(unitKey); setScopedSubTasks(refreshed.filter(x => String(x.section_id) === String(mySectionId))) }} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded">Remove</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {errorMsg && <div className="text-red-400 text-sm">{errorMsg}</div>}
                {createOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-6">
                      <h3 className="text-white text-lg mb-4">Create Task</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Description" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Location" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        <textarea value={newInstructions} onChange={e => setNewInstructions(e.target.value)} placeholder="Special instructions" rows={4} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                      </div>
                      <div className="mt-6 flex gap-2 justify-end">
                        <button onClick={async () => {
                          setErrorMsg('')
                          try {
                            if (!newDescription.trim() || !mySectionId) throw new Error('Description and section are required')
                            const unitKey = (user!.unit_id || '').includes('-') ? (user!.unit_id as string).split('-')[1] : (user!.unit_id as string)
                            const all = await listSubTasks(unitKey)
                            const inSection = all.filter(x => String(x.section_id) === String(mySectionId))
                            const nextNum = inSection.length + 1
                            const prefix = sectionPrefix || 'TASK'
                            const subId = `${prefix}-${String(nextNum).padStart(2, '0')}`
                            await createSubTask({ unit_id: unitKey, section_id: mySectionId!, sub_task_id: subId, description: newDescription.trim(), responsible_user_ids: defaultResponsible, location: newLocation.trim() || undefined, instructions: newInstructions.trim() || undefined })
                            const refreshed = await listSubTasks(unitKey)
                            setScopedSubTasks(refreshed.filter(x => String(x.section_id) === String(mySectionId)))
                            setCreateOpen(false)
                            setNewDescription('')
                            setNewLocation('')
                            setNewInstructions('')
                          } catch (err: any) {
                            setErrorMsg(err?.message || 'Failed to create task')
                          }
                        }} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
                        <button onClick={() => setCreateOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
