import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import HeaderTools from '@/components/HeaderTools'
import { googleMapsLink } from '@/utils/maps'
import { fetchJson, LocalUserProfile, UsersIndexEntry, getChecklistByUnit, listMembers } from '@/services/localDataService'
import { sbListUsers, sbListSubmissionsByUnit } from '@/services/supabaseDataService'
import { listSections } from '@/utils/unitStructure'
import { listSubTasks, createSubTask, updateSubTask, deleteSubTask, UnitSubTask } from '@/utils/unitTasks'
 
import { listForms } from '@/utils/formsStore'
import { supabase } from '@/services/supabaseClient'

export default function TaskManagerDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'inbound' | 'outbound' | 'tasks'>('inbound')
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [taskLabels, setTaskLabels] = useState<Record<string, { section_name: string; description: string }>>({})
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  const [inboundGroups, setInboundGroups] = useState<Record<string, string[]>>({})
  const [outboundGroups, setOutboundGroups] = useState<Record<string, string[]>>({})
  const [inboundSectionGroups, setInboundSectionGroups] = useState<Record<string, Array<{ subTaskId: string; members: string[] }>>>({})
  const [pendingByTask, setPendingByTask] = useState<Record<string, string[]>>({})
  const [completedByTask, setCompletedByTask] = useState<Record<string, string[]>>({})
  const [inboundCompletedGroups, setInboundCompletedGroups] = useState<Record<string, string[]>>({})
  const [inboundSectionGroupsCompleted, setInboundSectionGroupsCompleted] = useState<Record<string, Array<{ subTaskId: string; members: string[] }>>>({})
  const [inboundView, setInboundView] = useState<'Pending' | 'Completed'>('Pending')
  const [sectionLabel, setSectionLabel] = useState('')
  const [scopedTasks, setScopedTasks] = useState<Array<{ section: string; description: string; location?: string; instructions?: string; responsible: string }>>([])
  const [scopedSubTasks, setScopedSubTasks] = useState<UnitSubTask[]>([])
  const [mySectionId, setMySectionId] = useState<number | null>(null)
  const [sectionPrefix, setSectionPrefix] = useState('')
  const [defaultResponsible, setDefaultResponsible] = useState<string[]>([])
  const [taskEditingId, setTaskEditingId] = useState<number | null>(null)
  const [taskEditDescription, setTaskEditDescription] = useState('')
  const [taskEditLocation, setTaskEditLocation] = useState('')
  const [taskEditLocationUrl, setTaskEditLocationUrl] = useState('')
  const [taskEditInstructions, setTaskEditInstructions] = useState('')
  const [taskEditCompletionKind, setTaskEditCompletionKind] = useState<'Text' | 'Date' | 'Options' | ''>('')
  const [taskEditCompletionLabel, setTaskEditCompletionLabel] = useState('')
  const [taskEditCompletionOptions, setTaskEditCompletionOptions] = useState('')
  const [subTaskMap, setSubTaskMap] = useState<Record<string, UnitSubTask>>({})
  const [formNameByTask, setFormNameByTask] = useState<Record<string, string>>({})
  const [completionSelections, setCompletionSelections] = useState<Record<string, string | string[]>>({})
  const [actionMsg, setActionMsg] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [newDescription, setNewDescription] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newLocationUrl, setNewLocationUrl] = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  const [sectionInstructions, setSectionInstructions] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [taskFilterText, setTaskFilterText] = useState('')
  const [taskFilterKind, setTaskFilterKind] = useState<'All' | 'Text' | 'Date' | 'Options'>('All')

  useEffect(() => {
    if (!user || !user.unit_id) return
    const load = async () => {
      try { console.log('TaskManager init', { supabase: import.meta.env.VITE_USE_SUPABASE, unit: user.unit_id, platoon: user.platoon_id }) } catch {}
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
      try { console.log('Labels built', Object.keys(labels).length) } catch {}

      const members = await listMembers()
      // Build section display name map (code -> display)
      const displayMap: Record<string, string> = {}
      try {
        const allSecs = await listSections(unitKey)
        for (const s of allSecs) {
          const disp = ((s as any).display_name || s.section_name)
          displayMap[s.section_name] = disp
          displayMap[String(s.id)] = disp
        }
      } catch (err) { console.error(err) }
      setSectionDisplayMap(displayMap)
      try { console.log('Sections loaded', Object.keys(displayMap).length) } catch {}
      // Resolve user's section and load tasks from Supabase unit_sub_tasks
      let sectionTaskIds = new Set<string>()
      const subTaskById: Record<string, UnitSubTask> = {}
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
            subTaskById[t.sub_task_id] = t
          }
        }
      } catch (err) { console.error(err) }
      setSubTaskMap(subTaskById)
      try { console.log('SubTasks in section', Object.keys(subTaskById).length) } catch {}
      // Determine form-kind task id sets
      const ruc = (user.unit_id || '').includes('-') ? (user.unit_id || '').split('-')[1] : (user.unit_id || '')
      let inboundTaskIds = new Set<string>()
      let outboundTaskIds = new Set<string>()
      try {
        const forms = await listForms(ruc)
        inboundTaskIds = new Set(forms.filter(f => f.kind === 'Inbound').flatMap(f => f.task_ids))
        outboundTaskIds = new Set(forms.filter(f => f.kind === 'Outbound').flatMap(f => f.task_ids))
        const fn: Record<string, string> = {}
        for (const f of forms) {
          for (const tid of f.task_ids) {
            if (!fn[tid]) fn[tid] = f.name
          }
        }
        setFormNameByTask(fn)
      } catch (err) { console.error(err) }
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
      const inboundCompletedByTask: Record<string, Set<string>> = {}
      const outboundByTask: Record<string, Set<string>> = {}
      const allPendingByTask: Record<string, Set<string>> = {}
      const allCompletedByTask: Record<string, Set<string>> = {}
      try {
        const submissions = await sbListSubmissionsByUnit(user.unit_id)
        const platoonSubs = submissions.filter(s => String((s as any).member?.platoon_id) === String(user.platoon_id))
        for (const s of platoonSubs) {
          const kind = (s as any).kind as 'Inbound' | 'Outbound'
          const memberId = (s as any).user_id as string
          const tasks = ((s as any).tasks || []) as Array<{ sub_task_id: string; status: 'Pending' | 'Cleared' | 'Skipped' }>
          for (const t of tasks) {
            const subId = t.sub_task_id
            if (!responsibleSet.has(subId)) continue
            const inScope = sectionTaskIds.has(subId) || (sectionPrefix ? String(subId).startsWith(`${sectionPrefix}-`) : false)
            if (!inScope) continue
            if (t.status === 'Pending') {
              if (!allPendingByTask[subId]) allPendingByTask[subId] = new Set()
              allPendingByTask[subId].add(memberId)
              if (kind === 'Inbound' && inboundTaskIds.has(subId)) {
                if (!inboundByTask[subId]) inboundByTask[subId] = new Set()
                inboundByTask[subId].add(memberId)
              }
              if (kind === 'Outbound' && outboundTaskIds.has(subId)) {
                if (!outboundByTask[subId]) outboundByTask[subId] = new Set()
                outboundByTask[subId].add(memberId)
              }
            }
            if (t.status === 'Cleared') {
              if (!allCompletedByTask[subId]) allCompletedByTask[subId] = new Set()
              allCompletedByTask[subId].add(memberId)
              if (kind === 'Inbound' && inboundTaskIds.has(subId)) {
                if (!inboundCompletedByTask[subId]) inboundCompletedByTask[subId] = new Set()
                inboundCompletedByTask[subId].add(memberId)
              }
            }
          }
        }
      } catch (err) { console.error(err) }
      const inboundGroupsArr = Object.fromEntries(Object.entries(inboundByTask).map(([k, v]) => [k, Array.from(v)]))
      setInboundGroups(inboundGroupsArr)
      const inboundCompletedGroupsArr = Object.fromEntries(Object.entries(inboundCompletedByTask).map(([k, v]) => [k, Array.from(v)]))
      setInboundCompletedGroups(inboundCompletedGroupsArr)
      setOutboundGroups(Object.fromEntries(Object.entries(outboundByTask).map(([k, v]) => [k, Array.from(v)])))
      setPendingByTask(Object.fromEntries(Object.entries(allPendingByTask).map(([k, v]) => [k, Array.from(v)])))
      setCompletedByTask(Object.fromEntries(Object.entries(allCompletedByTask).map(([k, v]) => [k, Array.from(v)])))
      try { console.log('Inbound/Outbound sizes', { inbound: Object.keys(inboundGroupsArr).length, outbound: Object.keys(outboundByTask).length }) } catch {}

      const secGrouped: Record<string, Array<{ subTaskId: string; members: string[] }>> = {}
      for (const [subTaskId, members] of Object.entries(inboundGroupsArr)) {
        const sid = subTaskMap[subTaskId]?.section_id
        const key = sid ? String(sid) : ''
        let secName = key ? (sectionDisplayMap[key] || key) : ''
        if (!secName) {
          const label = taskLabels[subTaskId]
          const secCode = label?.section_name || ''
          secName = secCode ? (sectionDisplayMap[secCode] || secCode) : (sectionLabel || 'Section')
        }
        if (!secGrouped[secName]) secGrouped[secName] = []
        secGrouped[secName].push({ subTaskId, members })
      }
      setInboundSectionGroups(secGrouped)
      const secGroupedCompleted: Record<string, Array<{ subTaskId: string; members: string[] }>> = {}
      for (const [subTaskId, members] of Object.entries(inboundCompletedGroupsArr)) {
        const sid = subTaskMap[subTaskId]?.section_id
        const key = sid ? String(sid) : ''
        let secName = key ? (sectionDisplayMap[key] || key) : ''
        if (!secName) {
          const label = taskLabels[subTaskId]
          const secCode = label?.section_name || ''
          secName = secCode ? (sectionDisplayMap[secCode] || secCode) : (sectionLabel || 'Section')
        }
        if (!secGroupedCompleted[secName]) secGroupedCompleted[secName] = []
        secGroupedCompleted[secName].push({ subTaskId, members })
      }
      setInboundSectionGroupsCompleted(secGroupedCompleted)

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
      try { console.log('ScopedSubTasks count', filtered.length) } catch {}
    }
    load()
  }, [user, refreshKey])

  useEffect(() => {
    if (import.meta.env.VITE_USE_SUPABASE === '1') {
      const channel = supabase
        .channel('tm-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members_progress' }, () => setRefreshKey(k => k + 1))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'my_form_submissions' }, () => setRefreshKey(k => k + 1))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_sub_tasks' }, () => setRefreshKey(k => k + 1))
      channel.subscribe()
      return () => { supabase.removeChannel(channel) }
    } else {
      const onLocal = () => setRefreshKey(k => k + 1)
      window.addEventListener('progress-updated', onLocal as any)
      return () => window.removeEventListener('progress-updated', onLocal as any)
    }
  }, [user])

  const filteredScopedSubTasks = useMemo(() => {
    const text = taskFilterText.trim().toLowerCase()
    return scopedSubTasks.filter(t => {
      const matchesText = !text || (t.description || '').toLowerCase().includes(text) || (t.instructions || '').toLowerCase().includes(text) || (t.location || '').toLowerCase().includes(text)
      const matchesKind = taskFilterKind === 'All' || (t.completion_kind === taskFilterKind)
      return matchesText && matchesKind
    })
  }, [scopedSubTasks, taskFilterText, taskFilterKind])

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
                <div className="flex justify-end">
                  <div className="inline-flex rounded border border-github-border overflow-hidden">
                    <button onClick={() => setInboundView('Pending')} className={`px-3 py-1 text-xs ${inboundView === 'Pending' ? 'bg-github-blue text-white' : 'bg-github-gray bg-opacity-20 text-gray-300'}`}>Pending</button>
                    <button onClick={() => setInboundView('Completed')} className={`px-3 py-1 text-xs ${inboundView === 'Completed' ? 'bg-github-blue text-white' : 'bg-github-gray bg-opacity-20 text-gray-300'}`}>Completed</button>
                  </div>
                </div>

                {inboundView === 'Pending' && (
                  <div className="space-y-6">
                  {scopedSubTasks.map(t => {
                    const subTaskId = t.sub_task_id
                    const label = taskLabels[subTaskId]
                    const taskDesc = label?.description || subTaskId
                    const pendingMembers = (pendingByTask[subTaskId] || [])
                    const pendingCount = pendingMembers.length
                    const sid = subTaskMap[subTaskId]?.section_id
                    const key = sid ? String(sid) : ''
                    let secDisplay = key ? (sectionDisplayMap[key] || key) : ''
                    if (!secDisplay) {
                      const secCode = label?.section_name || ''
                      secDisplay = secCode ? (sectionDisplayMap[secCode] || secCode) : (sectionLabel || '')
                    }
                    return (
                      <div key={`bytask-${subTaskId}`} className="border border-github-border rounded-xl">
                        <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                          <h3 className="text-white text-sm">{taskDesc}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs border border-github-border rounded bg-yellow-700 bg-opacity-30 text-yellow-300`}>{pendingCount}</span>
                        </div>
                        <div className="p-4">
                          <table className="min-w-full text-sm">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="text-left p-2">Type</th>
                                <th className="text-left p-2">Member</th>
                                <th className="text-left p-2">EDIPI</th>
                                <th className="text-left p-2">Company</th>
                                <th className="text-left p-2">Section</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingMembers.map(mid => {
                                const m = memberMap[mid]
                                const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                                const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                                const edipi = m?.edipi || mid
                                const company = m?.company_id || ''
                                return (
                                  <tr key={`bytask-${subTaskId}-${mid}`} className="border-t border-github-border text-gray-300">
                                    <td className="p-2">{formNameByTask[subTaskId] || 'Inbound'}</td>
                                    <td className="p-2">{memberDisp}</td>
                                    <td className="p-2">{edipi}</td>
                                    <td className="p-2">{company}</td>
                                    <td className="p-2">{secDisplay}</td>
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

                {inboundView === 'Completed' && (
                  (Object.entries(inboundSectionGroupsCompleted).length
                    ? Object.entries(inboundSectionGroupsCompleted).map(([secName, groups]) => (
                        <div key={secName} className="border border-github-border rounded-xl">
                          <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                            <h3 className="text-white text-sm">{secName}</h3>
                            <span className="inline-flex items-center px-2 py-0.5 text-xs border border-github-border rounded bg-green-700 bg-opacity-30 text-green-300">Completed</span>
                          </div>
                          <div className="p-4">
                            <table className="min-w-full text-sm">
                              <thead className="text-gray-400">
                                <tr>
                                  <th className="text-left p-2">Type</th>
                                  <th className="text-left p-2">Task</th>
                                  <th className="text-left p-2">Member</th>
                                  <th className="text-left p-2">EDIPI</th>
                                  <th className="text-left p-2">Company</th>
                                  <th className="text-left p-2">Section</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groups.map(({ subTaskId, members }) => {
                                  const label = taskLabels[subTaskId]
                                  const taskDesc = label?.description || subTaskId
                                  return members.map(mid => {
                                    const m = memberMap[mid]
                                    const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                                    const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                                    const edipi = m?.edipi || mid
                                    const company = m?.company_id || ''
                                    return (
                                      <tr key={`${secName}-${subTaskId}-${mid}`} className="border-t border-github-border text-gray-300">
                                        <td className="p-2">{formNameByTask[subTaskId] || 'Inbound'}</td>
                                        <td className="p-2">{taskDesc}</td>
                                        <td className="p-2">{memberDisp}</td>
                                        <td className="p-2">{edipi}</td>
                                        <td className="p-2">{company}</td>
                                        <td className="p-2">{secName}</td>
                                      </tr>
                                    )
                                  })
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    : (
                        <div className="border border-github-border rounded-xl">
                          <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                            <h3 className="text-white text-sm">{sectionLabel || 'Section'}</h3>
                            <span className="inline-flex items-center px-2 py-0.5 text-xs border border-github-border rounded bg-green-700 bg-opacity-30 text-green-300">Completed</span>
                          </div>
                          <div className="p-4">
                            <table className="min-w-full text-sm">
                              <thead className="text-gray-400">
                                <tr>
                                  <th className="text-left p-2">Task</th>
                                  <th className="text-left p-2">Member</th>
                                  <th className="text-left p-2">EDIPI</th>
                                  <th className="text-left p-2">Company</th>
                                  <th className="text-left p-2">Section</th>
                                </tr>
                              </thead>
                              <tbody>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                  )
                )}

                
              </div>
            )}

            {tab === 'outbound' && (
              <div className="space-y-6">
                {Object.entries(outboundGroups).map(([subTaskId, members]) => {
                  const sid = subTaskMap[subTaskId]?.section_id
                  const key = sid ? String(sid) : ''
                  const secDisplay = key ? (sectionDisplayMap[key] || key) : ''
                  const label = taskLabels[subTaskId]
                  const title = `${secDisplay} - ${label?.description || subTaskId}`
                  return (
                    <div key={subTaskId} className="border border-github-border rounded-xl">
                      <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                        <h3 className="text-white text-sm">{title}</h3>
                        <button
                          className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs hover:bg-opacity-30"
                          onClick={() => setDetailsOpen(prev => ({ ...prev, [subTaskId]: !prev[subTaskId] }))}
                        >
                          Details
                        </button>
                      </div>
                      {detailsOpen[subTaskId] && (
                        <div className="px-4 py-3 text-sm text-gray-300 border-b border-github-border">
                          <div><span className="text-gray-400">Location:</span> {subTaskMap[subTaskId]?.location ? (<a href={subTaskMap[subTaskId]?.map_url || googleMapsLink(subTaskMap[subTaskId]!.location!)} target="_blank" rel="noopener noreferrer" className="text-semper-gold hover:underline">{subTaskMap[subTaskId]!.location}</a>) : ''}</div>
                          <div className="mb-1"><span className="text-gray-400">Instructions:</span> {subTaskMap[subTaskId]?.instructions || ''}</div>
                          <div className="mt-1"><span className="text-gray-400">Completion:</span> {[subTaskMap[subTaskId]?.completion_kind, subTaskMap[subTaskId]?.completion_label, (subTaskMap[subTaskId]?.completion_options || []).join('/')].filter(Boolean).join(' • ')}</div>
                        </div>
                      )}
                      <div className="p-4">
                        <table className="min-w-full text-sm">
                          <thead className="text-gray-400">
                            <tr>
                              <th className="text-left p-2">Type</th>
                              <th className="text-left p-2">Member</th>
                              <th className="text-left p-2">EDIPI</th>
                              <th className="text-left p-2">Company</th>
                              <th className="text-left p-2">Section</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map(mid => {
                              const m = memberMap[mid]
                              const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                              const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                              const edipi = m?.edipi || mid
                              const company = m?.company_id || ''
                              const secKey = m?.platoon_id ? String(m.platoon_id) : ''
                              const secLabel = sectionDisplayMap[secKey] || secKey || ''
                              return (
                                <tr key={`${subTaskId}-${mid}`} className="border-t border-github-border text-gray-300">
                                  <td className="p-2">{formNameByTask[subTaskId] || 'Outbound'}</td>
                                  <td className="p-2">{memberDisp}</td>
                                  <td className="p-2">{edipi}</td>
                                  <td className="p-2">{company}</td>
                                  <td className="p-2">{secLabel}</td>
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
                  <div className="flex gap-2">
                    <button onClick={() => { setErrorMsg(''); setEditingTaskId(null); setNewDescription(''); setNewLocation(''); setNewLocationUrl(''); setNewInstructions(''); setTaskEditCompletionKind(''); setTaskEditCompletionLabel(''); setTaskEditCompletionOptions('');
                      try { const unitKey = (user?.unit_id || '').includes('-') ? (user?.unit_id as string).split('-')[1] : (user?.unit_id as string); const key = mySectionId ? `section_instructions:${unitKey}:${mySectionId}` : ''; const val = key ? localStorage.getItem(key) || '' : ''; setSectionInstructions(val) } catch { setSectionInstructions('') }
                      setCreateOpen(true) }} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Create Task</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input value={taskFilterText} onChange={e => setTaskFilterText(e.target.value)} placeholder="Search tasks" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                  <select value={taskFilterKind} onChange={e => setTaskFilterKind(e.target.value as any)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                    <option value="All">All</option>
                    <option value="Text">Text</option>
                    <option value="Date">Date</option>
                    <option value="Options">Options</option>
                  </select>
                </div>
                <div className="text-gray-400 text-sm font-semibold">
                  <div className="grid grid-cols-[30%_20%_25%_15%_10%]">
                    <div className="text-left p-2">Description</div>
                    <div className="text-left p-2">Location</div>
                    <div className="text-left p-2">Instructions</div>
                    <div className="text-left p-2">Completion</div>
                    <div className="text-left p-2">Actions</div>
                  </div>
                </div>
                <table className="min-w-full table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <tbody>
                    {filteredScopedSubTasks.map(t => (
                      <tr key={t.id} className="border-t border-github-border text-gray-300">
                        <td className="p-2">{taskEditingId === t.id ? (
                          <textarea value={taskEditDescription} onChange={e => setTaskEditDescription(e.target.value)} rows={3} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.description)}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <input value={taskEditLocation} onChange={e => setTaskEditLocation(e.target.value)} placeholder="Location" className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                            <input value={taskEditLocationUrl} onChange={e => setTaskEditLocationUrl(e.target.value)} placeholder="Map URL" className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                          </div>
                        ) : (t.map_url || t.location ? (
                          <a href={(t.map_url || googleMapsLink(t.location || ''))} target="_blank" rel="noopener noreferrer" className="text-semper-gold hover:underline">{t.location || 'Map'}</a>
                        ) : '')}</td>
                        <td className="p-2">{taskEditingId === t.id ? (
                          <input value={taskEditInstructions} onChange={e => setTaskEditInstructions(e.target.value)} className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        ) : (t.instructions || '')}</td>
                        
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
                              <button onClick={async () => {
                                await updateSubTask(t.id, { description: taskEditDescription.trim(), location: taskEditLocation.trim() || undefined, map_url: taskEditLocationUrl.trim() || undefined, instructions: taskEditInstructions.trim() || undefined, completion_kind: taskEditCompletionKind || undefined, completion_label: taskEditCompletionLabel.trim() || undefined, completion_options: taskEditCompletionKind === 'Options' ? taskEditCompletionOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined })
                                setTaskEditingId(null)
                                setTaskEditDescription('')
                                setTaskEditLocation('')
                                setTaskEditLocationUrl('')
                                setTaskEditInstructions('')
                                setTaskEditCompletionKind('')
                                setTaskEditCompletionLabel('')
                                setTaskEditCompletionOptions('')
                                const unitKey = (user!.unit_id || '').includes('-') ? (user!.unit_id as string).split('-')[1] : (user!.unit_id as string)
                                const refreshed = await listSubTasks(unitKey)
                                setScopedSubTasks(refreshed.filter(x => String(x.section_id) === String(mySectionId)))
                              }} className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
                              <button onClick={() => { setTaskEditingId(null); setTaskEditDescription(''); setTaskEditLocation(''); setTaskEditLocationUrl(''); setTaskEditInstructions('') }} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingTaskId(t.id); setErrorMsg(''); setNewDescription(t.description || ''); setNewLocation(t.location || ''); setNewLocationUrl(t.map_url || ''); setNewInstructions(t.instructions || ''); setTaskEditCompletionKind(t.completion_kind || ''); setTaskEditCompletionLabel(t.completion_label || ''); setTaskEditCompletionOptions((t.completion_options || []).join(', '));
                                try { const unitKey = (user?.unit_id || '').includes('-') ? (user?.unit_id as string).split('-')[1] : (user?.unit_id as string); const key = mySectionId ? `section_instructions:${unitKey}:${mySectionId}` : ''; const val = key ? localStorage.getItem(key) || '' : ''; setSectionInstructions(val) } catch { setSectionInstructions('') }
                                setCreateOpen(true) }} className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded">Edit</button>
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
                      <h3 className="text-white text-lg mb-4">{editingTaskId ? 'Edit Task' : 'Create Task'}</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Description" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Location" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                          <input value={newLocationUrl} onChange={e => setNewLocationUrl(e.target.value)} placeholder="Map URL" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        </div>
                        <textarea value={newInstructions} onChange={e => setNewInstructions(e.target.value)} placeholder="Special instructions" rows={4} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        <textarea value={sectionInstructions} onChange={e => setSectionInstructions(e.target.value)} placeholder="Section instructions" rows={4} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        <select value={taskEditCompletionKind} onChange={e => setTaskEditCompletionKind(e.target.value as any)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                          <option value="">Completion type</option>
                          <option value="Text">Text</option>
                          <option value="Date">Date</option>
                          <option value="Options">Options</option>
                        </select>
                        <input value={taskEditCompletionLabel} onChange={e => setTaskEditCompletionLabel(e.target.value)} placeholder="Completion label" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        {taskEditCompletionKind === 'Options' && (
                          <input value={taskEditCompletionOptions} onChange={e => setTaskEditCompletionOptions(e.target.value)} placeholder="Completion options (comma-separated)" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                        )}
                      </div>
                      <div className="mt-6 flex gap-2 justify-end">
                        <button onClick={async () => {
                          setErrorMsg('')
                          try {
                            if (!newDescription.trim() || !mySectionId) throw new Error('Description and section are required')
                            const unitKey = (user!.unit_id || '').includes('-') ? (user!.unit_id as string).split('-')[1] : (user!.unit_id as string)
                            if (editingTaskId) {
                              await updateSubTask(editingTaskId, { description: newDescription.trim(), location: newLocation.trim() || undefined, map_url: newLocationUrl.trim() || undefined, instructions: newInstructions.trim() || undefined, completion_kind: taskEditCompletionKind || undefined, completion_label: taskEditCompletionLabel.trim() || undefined, completion_options: taskEditCompletionKind === 'Options' ? taskEditCompletionOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined })
                            } else {
                              const all = await listSubTasks(unitKey)
                              const inSection = all.filter(x => String(x.section_id) === String(mySectionId))
                              const nextNum = inSection.length + 1
                              const prefix = sectionPrefix || 'TASK'
                              const subId = `${prefix}-${String(nextNum).padStart(2, '0')}`
                              await createSubTask({ unit_id: unitKey, section_id: mySectionId!, sub_task_id: subId, description: newDescription.trim(), responsible_user_ids: defaultResponsible, location: newLocation.trim() || undefined, map_url: newLocationUrl.trim() || undefined, instructions: newInstructions.trim() || undefined, completion_kind: taskEditCompletionKind || undefined, completion_label: taskEditCompletionLabel.trim() || undefined, completion_options: taskEditCompletionKind === 'Options' ? taskEditCompletionOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined })
                            }
                            try { const key = mySectionId ? `section_instructions:${unitKey}:${mySectionId}` : ''; if (key) localStorage.setItem(key, sectionInstructions.trim()) } catch {}
                            const refreshed = await listSubTasks(unitKey)
                            setScopedSubTasks(refreshed.filter(x => String(x.section_id) === String(mySectionId)))
                            setCreateOpen(false)
                            setEditingTaskId(null)
                            setNewDescription('')
                            setNewLocation('')
                            setNewLocationUrl('')
                            setNewInstructions('')
                            setTaskEditCompletionKind('')
                            setTaskEditCompletionLabel('')
                            setTaskEditCompletionOptions('')
                          } catch (err: any) {
                            setErrorMsg(err?.message || (editingTaskId ? 'Failed to update task' : 'Failed to create task'))
                          }
                        }} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
                        <button onClick={() => { setCreateOpen(false); setEditingTaskId(null) }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
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
