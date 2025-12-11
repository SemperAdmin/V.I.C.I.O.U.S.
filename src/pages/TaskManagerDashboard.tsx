import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import HeaderTools from '@/components/HeaderTools'
import { googleMapsLink } from '@/utils/maps'
import { fetchJson, LocalUserProfile, UsersIndexEntry, getChecklistByUnit, listMembers, getProgressByMember } from '@/services/localDataService'
import { sbListUsers, sbListSubmissionsByUnit } from '@/services/supabaseDataService'
import { listSections } from '@/utils/unitStructure'
import { listSubTasks, createSubTask, updateSubTask, deleteSubTask, UnitSubTask } from '@/utils/unitTasks'
 
import { listForms } from '@/utils/formsStore'
import { supabase } from '@/services/supabaseClient'
import { canonicalize } from '@/utils/json'
import { sha256String } from '@/utils/crypto'
import { sbUpsertProgress, sbListSubmissions, sbUpdateSubmission } from '@/services/supabaseDataService'
import { triggerUpdateProgressDispatch } from '@/services/workflowService'

export default function TaskManagerDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'inbound' | 'outbound' | 'tasks'>('inbound')
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [taskLabels, setTaskLabels] = useState<Record<string, { section_name: string; description: string }>>({})
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  // Each entry is an array of { memberId, submissionId, date } for showing each submission separately
  type SubmissionEntry = { memberId: string; submissionId: number; date?: string; formName?: string; cleared_at?: string; cleared_by?: string; note?: string }
  const [inboundGroups, setInboundGroups] = useState<Record<string, SubmissionEntry[]>>({})
  const [outboundGroups, setOutboundGroups] = useState<Record<string, SubmissionEntry[]>>({})
  // Completed groups now also store submission details for log display
  const [inboundCompletedGroups, setInboundCompletedGroups] = useState<Record<string, SubmissionEntry[]>>({})
  const [outboundCompletedGroups, setOutboundCompletedGroups] = useState<Record<string, SubmissionEntry[]>>({})
  const [inboundSectionGroups, setInboundSectionGroups] = useState<Record<string, Array<{ subTaskId: string; members: string[] }>>>({})
  const [pendingByTask, setPendingByTask] = useState<Record<string, string[]>>({})
  const [completedByTask, setCompletedByTask] = useState<Record<string, string[]>>({})
  const [inboundSectionGroupsCompleted, setInboundSectionGroupsCompleted] = useState<Record<string, Array<{ subTaskId: string; members: string[] }>>>({})
  const [inboundView, setInboundView] = useState<'Pending' | 'Completed'>('Pending')
  const [outboundView, setOutboundView] = useState<'Pending' | 'Completed'>('Pending')
  const [outboundSectionGroupsCompleted, setOutboundSectionGroupsCompleted] = useState<Record<string, Array<{ subTaskId: string; members: string[] }>>>({})
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
  const [taskEditCompletionKind, setTaskEditCompletionKind] = useState<'Text' | 'Date' | 'Options' | 'Link' | ''>('')
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
  const [taskFilterKind, setTaskFilterKind] = useState<'All' | 'Text' | 'Date' | 'Options' | 'Link'>('All')
  const [actionOpen, setActionOpen] = useState(false)
  const [actionMemberId, setActionMemberId] = useState<string | null>(null)
  const [actionSubTaskId, setActionSubTaskId] = useState<string | null>(null)
  const [actionSubmissionId, setActionSubmissionId] = useState<number | null>(null)
  const [actionCompletionValue, setActionCompletionValue] = useState<string>('')
  const [actionSectionInstructions, setActionSectionInstructions] = useState<string>('')
  // Track which submission each pending task belongs to: { subTaskId -> { memberId -> submissionId } }
  const [submissionByTaskMember, setSubmissionByTaskMember] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    if (!user || !user.unit_id) return
    const load = async () => {
      console.log('TaskManager init', { supabase: import.meta.env.VITE_USE_SUPABASE, unit: user.unit_id, platoon: user.platoon_id })
      const unitKey = (user.unit_id || '').includes('-') ? (user.unit_id as string).split('-')[1] : (user.unit_id as string)
      const profiles: Record<string, LocalUserProfile> = {}
      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        try {
          const allUsers = await sbListUsers()
          for (const profile of allUsers) {
            profiles[profile.user_id] = profile
          }
        } catch (err) { console.error(err) }
      }
      if (Object.keys(profiles).length === 0) {
        try {
          const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
          for (const entry of index.users) {
            const profile = await fetchJson<LocalUserProfile>(`/${entry.path}`)
            profiles[profile.user_id] = profile
          }
        } catch (err) { console.error(err) }
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
      console.log('Labels built', Object.keys(labels).length)

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
      console.log('Sections loaded', Object.keys(displayMap).length)
      // Resolve user's section and load tasks from Supabase unit_sub_tasks
      const sectionTaskIds = new Set<string>()
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
      console.log('SubTasks in section', Object.keys(subTaskById).length)
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
      const sectionMembers = Object.values(profiles).filter(p => p.unit_id === user.unit_id && (user.platoon_id ? String(p.platoon_id) === String(user.platoon_id) : true))
      const unitMembers = Object.values(profiles).filter(p => p.unit_id === user.unit_id)
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

      // Track each submission separately - array of { memberId, submissionId, date, formName, and log fields }
      type SubmissionEntry = { memberId: string; submissionId: number; date?: string; formName?: string; cleared_at?: string; cleared_by?: string; note?: string }
      const inboundByTask: Record<string, SubmissionEntry[]> = {}
      const inboundCompletedByTask: Record<string, SubmissionEntry[]> = {}
      const outboundByTask: Record<string, SubmissionEntry[]> = {}
      const outboundCompletedByTask: Record<string, SubmissionEntry[]> = {}
      const allPendingByTask: Record<string, Set<string>> = {}
      const allCompletedByTask: Record<string, Set<string>> = {}
      // Track submission IDs: { subTaskId -> { memberId -> submissionId } }
      const submissionTracking: Record<string, Record<string, number>> = {}
      try {
        const submissions = await sbListSubmissionsByUnit(user.unit_id)
        for (const s of submissions) {
          const kind = (s as any).kind as 'Inbound' | 'Outbound'
          const memberId = (s as any).user_id as string
          const submissionId = (s as any).id as number
          const formName = (s as any).form_name || ''
          // Extract dates: arrival_date for inbound, departure_date for outbound (stored directly on submission)
          const arrivalDate = (s as any).arrival_date || ''
          const departureDate = (s as any).departure_date || ''
          const tasks = ((s as any).tasks || []) as Array<{ sub_task_id: string; status: 'Pending' | 'Cleared' | 'Skipped' }>
          for (const t of tasks) {
            const subId = t.sub_task_id
            if (t.status === 'Pending') {
              if (!allPendingByTask[subId]) allPendingByTask[subId] = new Set()
              allPendingByTask[subId].add(memberId)
              // Track which submission this pending task belongs to
              if (!submissionTracking[subId]) submissionTracking[subId] = {}
              submissionTracking[subId][memberId] = submissionId
              // Add to kind-specific pending list with submission details (each submission separate)
              if (kind === 'Inbound') {
                if (!inboundByTask[subId]) inboundByTask[subId] = []
                inboundByTask[subId].push({ memberId, submissionId, date: arrivalDate, formName })
              }
              if (kind === 'Outbound') {
                if (!outboundByTask[subId]) outboundByTask[subId] = []
                outboundByTask[subId].push({ memberId, submissionId, date: departureDate, formName })
              }
            }
            if (t.status === 'Cleared') {
              if (!allCompletedByTask[subId]) allCompletedByTask[subId] = new Set()
              allCompletedByTask[subId].add(memberId)
              // Add to kind-specific completed list with submission details including log info
              const cleared_at = (t as any).cleared_at_timestamp || ''
              const cleared_by_user_id = (t as any).cleared_by_user_id || ''
              const cleared_by_edipi = (t as any).cleared_by_edipi || ''
              // Look up cleared_by name from memberMap
              const clearedByMember = cleared_by_user_id ? profiles[cleared_by_user_id] : undefined
              const cleared_by = clearedByMember
                ? [clearedByMember.rank, [clearedByMember.first_name, clearedByMember.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ')
                : (cleared_by_edipi ? `EDIPI ${cleared_by_edipi}` : '')
              const note = (t as any).note || ''
              if (kind === 'Inbound') {
                if (!inboundCompletedByTask[subId]) inboundCompletedByTask[subId] = []
                inboundCompletedByTask[subId].push({ memberId, submissionId, date: arrivalDate, formName, cleared_at, cleared_by, note })
              }
              if (kind === 'Outbound') {
                if (!outboundCompletedByTask[subId]) outboundCompletedByTask[subId] = []
                outboundCompletedByTask[subId].push({ memberId, submissionId, date: departureDate, formName, cleared_at, cleared_by, note })
              }
            }
          }
        }
        setSubmissionByTaskMember(submissionTracking)

        // NOTE: We no longer use global members_progress to override submission-specific task status.
        // Each submission's tasks array is the source of truth for that submission's pending/completed status.
        // This ensures that multiple submissions of the same form are truly independent.
      } catch (err) { console.error(err) }
      // inboundByTask is now already an array of SubmissionEntry objects
      setInboundGroups(inboundByTask)
      // Completed groups also use full SubmissionEntry arrays for log display
      setInboundCompletedGroups(inboundCompletedByTask)
      setOutboundCompletedGroups(outboundCompletedByTask)
      setOutboundGroups(outboundByTask)
      setPendingByTask(Object.fromEntries(Object.entries(allPendingByTask).map(([k, v]) => [k, Array.from(v)])))
      setCompletedByTask(Object.fromEntries(Object.entries(allCompletedByTask).map(([k, v]) => [k, Array.from(v)])))
      console.log('Inbound/Outbound sizes', { inbound: Object.keys(inboundByTask).length, outbound: Object.keys(outboundByTask).length })

      const secGrouped: Record<string, Array<{ subTaskId: string; members: string[] }>> = {}
      for (const [subTaskId, entries] of Object.entries(inboundByTask)) {
        const members = entries.map(e => e.memberId)
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
      for (const [subTaskId, entries] of Object.entries(inboundCompletedByTask)) {
        const members = entries.map(e => e.memberId)
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

      const obSecGroupedCompleted: Record<string, Array<{ subTaskId: string; members: string[] }>> = {}
      for (const [subTaskId, entries] of Object.entries(outboundCompletedByTask)) {
        const members = entries.map(e => e.memberId)
        const sid = subTaskMap[subTaskId]?.section_id
        const key = sid ? String(sid) : ''
        let secName = key ? (sectionDisplayMap[key] || key) : ''
        if (!secName) {
          const label = taskLabels[subTaskId]
          const secCode = label?.section_name || ''
          secName = secCode ? (sectionDisplayMap[secCode] || secCode) : (sectionLabel || 'Section')
        }
        if (!obSecGroupedCompleted[secName]) obSecGroupedCompleted[secName] = []
        obSecGroupedCompleted[secName].push({ subTaskId, members })
      }
      setOutboundSectionGroupsCompleted(obSecGroupedCompleted)

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
      console.log('ScopedSubTasks count', filtered.length)
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
                    // Use inboundGroups which now has submission entries (each submission separate)
                    const pendingSubmissions = (inboundGroups[subTaskId] || [])
                    const pendingCount = pendingSubmissions.length
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
                          <div className="overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs sm:text-sm">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="text-left p-2">Type</th>
                                <th className="text-left p-2">Member</th>
                                <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                                <th className="text-left p-2">Company</th>
                                <th className="text-left p-2">Arrival</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingSubmissions.map((entry, idx) => {
                                const mid = entry.memberId
                                const m = memberMap[mid]
                                const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                                const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                                const edipi = m?.edipi || mid
                                const company = m?.company_id || ''
                                // Format date for display
                                const dateDisplay = entry.date ? new Date(entry.date).toLocaleDateString() : '-'
                                return (
                                  <tr
                                    key={`bytask-${subTaskId}-${entry.submissionId}-${idx}`}
                                    className="border-t border-github-border text-gray-300 cursor-pointer"
                                    onClick={() => {
                                      setActionSubTaskId(subTaskId)
                                      setActionMemberId(mid)
                                      // Use the specific submission ID from this row
                                      setActionSubmissionId(entry.submissionId)
                                      const unitKey = (user?.unit_id || '').includes('-') ? (user?.unit_id as string).split('-')[1] : (user?.unit_id as string)
                                      const sid = subTaskMap[subTaskId]?.section_id
                                      const key = sid ? `section_instructions:${unitKey}:${sid}` : ''
                                      try { setActionSectionInstructions(key ? (localStorage.getItem(key) || '') : '') } catch { setActionSectionInstructions('') }
                                      setActionCompletionValue('')
                                      setActionOpen(true)
                                    }}
                                  >
                                    <td className="p-2">{entry.formName || formNameByTask[subTaskId] || 'Inbound'}</td>
                                    <td className="p-2 truncate">{memberDisp}</td>
                                    <td className="p-2 hidden sm:table-cell">{edipi}</td>
                                    <td className="p-2">{company}</td>
                                    <td className="p-2">{dateDisplay}</td>
                                  </tr>
                                )
                              })}
                            </tbody>

                          </table>
                          </div>
                          </div>
                      </div>
                    )
                  })}
                  </div>
                )}

                {inboundView === 'Completed' && (
                  <div className="space-y-6">
                  {scopedSubTasks.map(t => {
                    const subTaskId = t.sub_task_id
                    const label = taskLabels[subTaskId]
                    const taskDesc = label?.description || subTaskId
                    // Use inboundCompletedGroups which has full submission details
                    const completedSubmissions = (inboundCompletedGroups[subTaskId] || [])
                    const completedCount = completedSubmissions.length
                    if (completedCount === 0) return null
                    return (
                      <div key={`completed-${subTaskId}`} className="border border-github-border rounded-xl">
                        <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                          <h3 className="text-white text-sm">{taskDesc}</h3>
                          <span className="inline-flex items-center px-2 py-0.5 text-xs border border-github-border rounded bg-green-700 bg-opacity-30 text-green-300">{completedCount}</span>
                        </div>
                        <div className="p-4">
                          <div className="overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs sm:text-sm">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="text-left p-2">Type</th>
                                <th className="text-left p-2">Member</th>
                                <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                                <th className="text-left p-2">Log</th>
                                <th className="text-left p-2">When</th>
                              </tr>
                            </thead>
                            <tbody>
                              {completedSubmissions.map((entry, idx) => {
                                const mid = entry.memberId
                                const m = memberMap[mid]
                                const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                                const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                                const edipi = m?.edipi || mid
                                // Format cleared_at date for display
                                const whenDisplay = entry.cleared_at ? new Date(entry.cleared_at).toLocaleString() : '-'
                                const logDisplay = entry.cleared_by || entry.note || '-'
                                return (
                                  <tr
                                    key={`completed-${subTaskId}-${entry.submissionId}-${idx}`}
                                    className="border-t border-github-border text-gray-300"
                                  >
                                    <td className="p-2">{entry.formName || formNameByTask[subTaskId] || 'Inbound'}</td>
                                    <td className="p-2 truncate">{memberDisp}</td>
                                    <td className="p-2 hidden sm:table-cell">{edipi}</td>
                                    <td className="p-2">{logDisplay}</td>
                                    <td className="p-2">{whenDisplay}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}

                
              </div>
            )}

            {tab === 'outbound' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <div className="inline-flex rounded border border-github-border overflow-hidden">
                    <button onClick={() => setOutboundView('Pending')} className={`px-3 py-1 text-xs ${outboundView === 'Pending' ? 'bg-github-blue text-white' : 'bg-github-gray bg-opacity-20 text-gray-300'}`}>Pending</button>
                    <button onClick={() => setOutboundView('Completed')} className={`px-3 py-1 text-xs ${outboundView === 'Completed' ? 'bg-github-blue text-white' : 'bg-github-gray bg-opacity-20 text-gray-300'}`}>Completed</button>
                  </div>
                </div>

                {outboundView === 'Pending' && (
                  <div className="space-y-6">
                  {scopedSubTasks.map(t => {
                    const subTaskId = t.sub_task_id
                    const label = taskLabels[subTaskId]
                    const taskDesc = label?.description || subTaskId
                    // Use outboundGroups which now has submission entries (each submission separate)
                    const pendingSubmissions = (outboundGroups[subTaskId] || [])
                    const pendingCount = pendingSubmissions.length
                    const sid = subTaskMap[subTaskId]?.section_id
                    const key = sid ? String(sid) : ''
                    let secDisplay = key ? (sectionDisplayMap[key] || key) : ''
                    if (!secDisplay) {
                      const secCode = label?.section_name || ''
                      secDisplay = secCode ? (sectionDisplayMap[secCode] || secCode) : (sectionLabel || '')
                    }
                    return (
                      <div key={`ob-bytask-${subTaskId}`} className="border border-github-border rounded-xl">
                        <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                          <h3 className="text-white text-sm">{taskDesc}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs border border-github-border rounded bg-yellow-700 bg-opacity-30 text-yellow-300`}>{pendingCount}</span>
                        </div>
                        <div className="p-4">
                          <div className="overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs sm:text-sm">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="text-left p-2">Type</th>
                                <th className="text-left p-2">Member</th>
                                <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                                <th className="text-left p-2">Company</th>
                                <th className="text-left p-2">Departure</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingSubmissions.map((entry, idx) => {
                                const mid = entry.memberId
                                const m = memberMap[mid]
                                const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                                const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                                const edipi = m?.edipi || mid
                                const company = m?.company_id || ''
                                // Format date for display
                                const dateDisplay = entry.date ? new Date(entry.date).toLocaleDateString() : '-'
                                return (
                                  <tr
                                    key={`ob-bytask-${subTaskId}-${entry.submissionId}-${idx}`}
                                    className="border-t border-github-border text-gray-300 cursor-pointer"
                                    onClick={() => {
                                      setActionSubTaskId(subTaskId)
                                      setActionMemberId(mid)
                                      // Use the specific submission ID from this row
                                      setActionSubmissionId(entry.submissionId)
                                      const unitKey = (user?.unit_id || '').includes('-') ? (user?.unit_id as string).split('-')[1] : (user?.unit_id as string)
                                      const sid = subTaskMap[subTaskId]?.section_id
                                      const key = sid ? `section_instructions:${unitKey}:${sid}` : ''
                                      try { setActionSectionInstructions(key ? (localStorage.getItem(key) || '') : '') } catch { setActionSectionInstructions('') }
                                      setActionCompletionValue('')
                                      setActionOpen(true)
                                    }}
                                  >
                                    <td className="p-2">{entry.formName || formNameByTask[subTaskId] || 'Outbound'}</td>
                                    <td className="p-2 truncate">{memberDisp}</td>
                                    <td className="p-2 hidden sm:table-cell">{edipi}</td>
                                    <td className="p-2">{company}</td>
                                    <td className="p-2">{dateDisplay}</td>
                                  </tr>
                                )
                              })}
                            </tbody>

                          </table>
                        </div>
                      </div>
                      </div>
                    )
                  })}
                  </div>
                )}
                {outboundView === 'Completed' && (
                  <div className="space-y-6">
                  {scopedSubTasks.map(t => {
                    const subTaskId = t.sub_task_id
                    const label = taskLabels[subTaskId]
                    const taskDesc = label?.description || subTaskId
                    // Use outboundCompletedGroups which has full submission details
                    const completedSubmissions = (outboundCompletedGroups[subTaskId] || [])
                    const completedCount = completedSubmissions.length
                    if (completedCount === 0) return null
                    return (
                      <div key={`ob-completed-${subTaskId}`} className="border border-github-border rounded-xl">
                        <div className="px-4 py-3 border-b border-github-border flex items-center justify-between">
                          <h3 className="text-white text-sm">{taskDesc}</h3>
                          <span className="inline-flex items-center px-2 py-0.5 text-xs border border-github-border rounded bg-green-700 bg-opacity-30 text-green-300">{completedCount}</span>
                        </div>
                        <div className="p-4">
                          <div className="overflow-x-auto">
                          <table className="min-w-full table-fixed text-xs sm:text-sm">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="text-left p-2">Type</th>
                                <th className="text-left p-2">Member</th>
                                <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                                <th className="text-left p-2">Log</th>
                                <th className="text-left p-2">When</th>
                              </tr>
                            </thead>
                            <tbody>
                              {completedSubmissions.map((entry, idx) => {
                                const mid = entry.memberId
                                const m = memberMap[mid]
                                const fullName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
                                const memberDisp = [m?.rank, fullName].filter(Boolean).join(' ') || mid
                                const edipi = m?.edipi || mid
                                // Format cleared_at date for display
                                const whenDisplay = entry.cleared_at ? new Date(entry.cleared_at).toLocaleString() : '-'
                                const logDisplay = entry.cleared_by || entry.note || '-'
                                return (
                                  <tr
                                    key={`ob-completed-${subTaskId}-${entry.submissionId}-${idx}`}
                                    className="border-t border-github-border text-gray-300"
                                  >
                                    <td className="p-2">{entry.formName || formNameByTask[subTaskId] || 'Outbound'}</td>
                                    <td className="p-2 truncate">{memberDisp}</td>
                                    <td className="p-2 hidden sm:table-cell">{edipi}</td>
                                    <td className="p-2">{logDisplay}</td>
                                    <td className="p-2">{whenDisplay}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}
                

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
                <div className="flex flex-wrap gap-2">
                  <input value={taskFilterText} onChange={e => setTaskFilterText(e.target.value)} placeholder="Search tasks" className="flex-1 min-w-[120px] px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm" />
                  <select value={taskFilterKind} onChange={e => setTaskFilterKind(e.target.value as any)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm">
                    <option value="All">All</option>
                    <option value="Text">Text</option>
                    <option value="Date">Date</option>
                    <option value="Options">Options</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="text-gray-400 text-sm font-semibold">
                    <tr>
                      <th className="text-left p-2 min-w-[150px]">Description</th>
                      <th className="text-left p-2 min-w-[80px]">Location</th>
                      <th className="text-left p-2 min-w-[100px] hidden sm:table-cell">Instructions</th>
                      <th className="text-left p-2 min-w-[100px]">Completion</th>
                      <th className="text-left p-2 min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
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
                        <td className="p-2 hidden sm:table-cell">{taskEditingId === t.id ? (
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
                </div>
                {errorMsg && <div className="text-red-400 text-sm">{errorMsg}</div>}

                
                {createOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-black border border-github-border rounded-xl p-6">
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
                            try { const key = mySectionId ? `section_instructions:${unitKey}:${mySectionId}` : ''; if (key) localStorage.setItem(key, sectionInstructions.trim()) } catch (err) { console.error(err) }
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
      {actionOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-black border border-github-border rounded-xl p-6">
            <h3 className="text-white text-lg mb-4">Task Manager Action</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="text-gray-300">
                {(() => {
                  const m = actionMemberId ? memberMap[actionMemberId] : undefined
                  const name = m ? [m.rank, [m.first_name, m.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ') : ''
                  const edipi = m?.edipi || ''
                  const comp = m?.company_id || ''
                  const secKey = m?.platoon_id ? String(m.platoon_id) : ''
                  const secLabel = secKey ? (sectionDisplayMap[secKey] || secKey) : ''
                  return (
                    <div className="grid grid-cols-4 gap-3">
                      <div><span className="text-gray-400">Member:</span> {name}</div>
                      <div><span className="text-gray-400">EDIPI:</span> {edipi}</div>
                      <div><span className="text-gray-400">Company:</span> {comp}</div>
                      <div><span className="text-gray-400">Section:</span> {secLabel}</div>
                    </div>
                  )
                })()}
              </div>
              <div className="text-gray-300">
                <div className="mb-1"><span className="text-gray-400">Section Instructions:</span></div>
                <div className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white whitespace-pre-wrap">{actionSectionInstructions || 'None'}</div>
              </div>
              <div className="text-gray-300">
                {(() => {
                  const st = actionSubTaskId ? subTaskMap[actionSubTaskId] : undefined
                  const kind = st?.completion_kind || ''
                  const label = st?.completion_label || ''
                  const opts = (st?.completion_options || [])
                  return (
                    <div className="grid grid-cols-1 gap-2">
                      <div className="text-gray-400">{[kind, label].filter(Boolean).join(' • ')}</div>
                      {kind === 'Date' ? (
                        <input type="date" value={actionCompletionValue} onChange={e => setActionCompletionValue(e.target.value)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                      ) : kind === 'Options' ? (
                        <select value={actionCompletionValue} onChange={e => setActionCompletionValue(e.target.value)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                          <option value="">Select</option>
                          {opts.map(o => (<option key={o} value={o}>{o}</option>))}
                        </select>
                      ) : (
                        <input value={actionCompletionValue} onChange={e => setActionCompletionValue(e.target.value)} placeholder="Enter value" className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                      )}
                    </div>
                  )
                })()}
              </div>
              {actionMsg && <div className="text-red-400 text-sm">{actionMsg}</div>}
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button onClick={async () => {
                setActionMsg('')
                try {
                  if (!user || !actionMemberId || !actionSubTaskId) throw new Error('Missing selection')
                  const checklist = await getChecklistByUnit(user.unit_id)
                  const taskDef = checklist.sections.flatMap(s => s.sub_tasks).find(st => st.sub_task_id === actionSubTaskId)
                  if (actionMemberId === user.user_id && taskDef && (taskDef.responsible_user_id || []).includes(user.user_id)) throw new Error('Cannot sign-off your own task when you are the POC')

                  let progress = await getProgressByMember(actionMemberId)
                  const initialCanonical = canonicalize(progress)
                  const initialSha = await sha256String(initialCanonical)
                  if (!progress.current_file_sha) {
                    progress.current_file_sha = initialSha
                  } else if (progress.current_file_sha !== initialSha) {
                    const refreshed = await getProgressByMember(actionMemberId)
                    const refreshedCanonical = canonicalize(refreshed)
                    const refreshedSha = await sha256String(refreshedCanonical)
                    if (!refreshed.current_file_sha || refreshed.current_file_sha !== refreshedSha) {
                      refreshed.current_file_sha = refreshedSha
                    }
                    progress = refreshed
                  }

                  const now = new Date().toISOString()
                  const st = actionSubTaskId ? subTaskMap[actionSubTaskId] : undefined
                  const label = st?.completion_label || ''
                  const note = [label, actionCompletionValue].filter(Boolean).join(': ') || 'Cleared'
                  const idx = progress.progress_tasks.findIndex(t => t.sub_task_id === actionSubTaskId)
                  if (idx === -1) {
                    const entry: any = { sub_task_id: actionSubTaskId, status: 'Cleared', cleared_by_user_id: user.user_id, cleared_by_edipi: user.edipi, cleared_at_timestamp: now, logs: [{ at: now, note }] }
                    progress.progress_tasks.push(entry as any)
                  } else {
                    progress.progress_tasks[idx].status = 'Cleared'
                    ;(progress.progress_tasks[idx] as any).cleared_by_user_id = user.user_id
                    ;(progress.progress_tasks[idx] as any).cleared_by_edipi = user.edipi
                    ;(progress.progress_tasks[idx] as any).cleared_at_timestamp = now
                    const logsArr = Array.isArray((progress.progress_tasks[idx] as any).logs) ? (progress.progress_tasks[idx] as any).logs : []
                    logsArr.push({ at: now, note })
                    ;(progress.progress_tasks[idx] as any).logs = logsArr
                  }
                  const finalCanonical = canonicalize(progress)
                  const finalSha = await sha256String(finalCanonical)
                  progress.current_file_sha = finalSha

                  if (import.meta.env.VITE_USE_SUPABASE === '1') {
                    await sbUpsertProgress(progress)
                    try {
                      // CRITICAL: Update the specific submission by ID, not the "latest"
                      if (actionSubmissionId) {
                        // We have the specific submission ID - update only that submission
                        const subs = await sbListSubmissions(actionMemberId)
                        const targetSubmission = subs.find(s => s.id === actionSubmissionId)
                        if (targetSubmission) {
                          const ids = Array.isArray((targetSubmission as any).task_ids)
                            ? ((targetSubmission as any).task_ids as string[])
                            : (targetSubmission.tasks || []).map(t => t.sub_task_id)
                          const total = ids.length
                          // Use form-scoped task status: preserve existing statuses and only update the current task
                          const existingTasks = Array.isArray((targetSubmission as any).tasks) ? (((targetSubmission as any).tasks || []) as Array<{ sub_task_id: string; description?: string; status?: 'Pending' | 'Cleared' | 'Skipped'; cleared_by_user_id?: string; cleared_by_edipi?: string; cleared_at_timestamp?: string; note?: string }>) : []
                          const byId: Record<string, { sub_task_id: string; description?: string; status?: 'Pending' | 'Cleared' | 'Skipped'; cleared_by_user_id?: string; cleared_by_edipi?: string; cleared_at_timestamp?: string; note?: string }> = {}
                          for (const t of existingTasks) byId[String(t.sub_task_id)] = t
                          const nextTasks = ids.map(tid => {
                            const isBeingCleared = tid === actionSubTaskId
                            return {
                              sub_task_id: tid,
                              description: (byId[tid]?.description || taskLabels[tid]?.description || tid),
                              // CRITICAL: Keep existing status, only update if this is the task being signed off
                              status: (isBeingCleared ? 'Cleared' : (byId[tid]?.status || 'Pending')) as 'Pending' | 'Cleared' | 'Skipped',
                              // Include log fields when clearing
                              cleared_by_user_id: isBeingCleared ? user.user_id : byId[tid]?.cleared_by_user_id,
                              cleared_by_edipi: isBeingCleared ? user.edipi : byId[tid]?.cleared_by_edipi,
                              cleared_at_timestamp: isBeingCleared ? now : byId[tid]?.cleared_at_timestamp,
                              note: isBeingCleared ? note : byId[tid]?.note,
                            }
                          })
                          // Calculate cleared count from submission's own tasks, not global progress
                          const submissionClearedSet = new Set(nextTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                          const cleared = ids.filter(id => submissionClearedSet.has(id)).length
                          const status: 'In_Progress' | 'Completed' = total > 0 && cleared === total ? 'Completed' : 'In_Progress'
                          await sbUpdateSubmission(actionSubmissionId, { completed_count: cleared, total_count: total, status, task_ids: ids, tasks: nextTasks as any })
                        }
                      } else {
                        // Fallback: no submission ID tracked, try to find by form (legacy behavior)
                        const ruc = (user.unit_id || '').includes('-') ? (user.unit_id || '').split('-')[1] : (user.unit_id || '')
                        const forms = await listForms(ruc)
                        const affected = forms.filter(f => actionSubTaskId && f.task_ids.includes(actionSubTaskId))
                        if (affected.length) {
                          const subs = await sbListSubmissions(actionMemberId)
                          for (const f of affected) {
                            const ids = f.task_ids
                            const total = ids.length
                            const latest = subs.filter(s => s.form_id === f.id && s.kind === f.kind).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                            if (latest) {
                              const existingTasks = Array.isArray((latest as any).tasks) ? (((latest as any).tasks || []) as Array<{ sub_task_id: string; description?: string; status?: 'Pending' | 'Cleared' | 'Skipped'; cleared_by_user_id?: string; cleared_by_edipi?: string; cleared_at_timestamp?: string; note?: string }>) : []
                              const byId: Record<string, { sub_task_id: string; description?: string; status?: 'Pending' | 'Cleared' | 'Skipped'; cleared_by_user_id?: string; cleared_by_edipi?: string; cleared_at_timestamp?: string; note?: string }> = {}
                              for (const t of existingTasks) byId[String(t.sub_task_id)] = t
                              const nextTasks = ids.map(tid => {
                                const isBeingCleared = tid === actionSubTaskId
                                return {
                                  sub_task_id: tid,
                                  description: (byId[tid]?.description || taskLabels[tid]?.description || tid),
                                  status: (isBeingCleared ? 'Cleared' : (byId[tid]?.status || 'Pending')) as 'Pending' | 'Cleared' | 'Skipped',
                                  cleared_by_user_id: isBeingCleared ? user.user_id : byId[tid]?.cleared_by_user_id,
                                  cleared_by_edipi: isBeingCleared ? user.edipi : byId[tid]?.cleared_by_edipi,
                                  cleared_at_timestamp: isBeingCleared ? now : byId[tid]?.cleared_at_timestamp,
                                  note: isBeingCleared ? note : byId[tid]?.note,
                                }
                              })
                              const submissionClearedSet = new Set(nextTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                              const cleared = ids.filter(id => submissionClearedSet.has(id)).length
                              const status: 'In_Progress' | 'Completed' = total > 0 && cleared === total ? 'Completed' : 'In_Progress'
                              await sbUpdateSubmission(latest.id, { completed_count: cleared, total_count: total, status, task_ids: ids, tasks: nextTasks as any })
                            }
                          }
                        }
                      }
                    } catch {}
                  } else {
                    await triggerUpdateProgressDispatch({ progress })
                  }

                  window.dispatchEvent(new CustomEvent('progress-updated', { detail: { member_user_id: actionMemberId } }))
                  setActionOpen(false)
                  setActionMemberId(null)
                  setActionSubTaskId(null)
                  setActionSubmissionId(null)
                  setActionCompletionValue('')
                  setActionSectionInstructions('')
                  setRefreshKey(k => k + 1)
                } catch (err: any) {
                  setActionMsg(err?.message || 'Failed to save')
                }
              }} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
              <button onClick={() => { setActionOpen(false); setActionMemberId(null); setActionSubTaskId(null); setActionSubmissionId(null); setActionCompletionValue(''); setActionSectionInstructions('') }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
