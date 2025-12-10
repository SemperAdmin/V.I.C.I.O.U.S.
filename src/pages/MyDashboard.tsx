import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import { useAuthStore } from '@/stores/authStore'
import { listPendingForSectionManager, listArchivedForUser, getProgressByMember, getChecklistByUnit, fetchJson, LocalUserProfile, UsersIndexEntry } from '@/services/localDataService'
import { listSections } from '@/utils/unitStructure'
import { listForms, UnitForm } from '@/utils/formsStore'
import { listSubTasks, UnitSubTask } from '@/utils/unitTasks'
import { UNITS } from '@/utils/units'
import { getRoleOverride } from '@/utils/localUsersStore'
import { googleMapsLink } from '@/utils/maps'
import { normalizeOrgRole, normalizeSectionRole } from '@/utils/roles'
import { sbListUsers, sbListMemberFormCompletion } from '@/services/supabaseDataService'
import { listMyItems, createMyItem, MyItem } from '@/utils/myItemsStore'
import { createSubmission, listSubmissions, MyFormSubmission } from '@/utils/myFormSubmissionsStore'
import { sbUpsertProgress } from '@/services/supabaseDataService'
import { supabase } from '@/services/supabaseClient'
import { triggerUpdateProgressDispatch } from '@/services/workflowService'
import { canonicalize } from '@/utils/json'
import { sha256String } from '@/utils/crypto'

export default function MyDashboard() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [memberTasks, setMemberTasks] = useState<{ sub_task_id: string; status: string }[]>([])
  const [pendingSection, setPendingSection] = useState<{ member_user_id: string; sub_task_id: string }[]>([])
  const [myInbound, setMyInbound] = useState<MyItem[]>([])
  const [myOutbound, setMyOutbound] = useState<MyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound')
  const [createOpen, setCreateOpen] = useState(false)
  const [newKind, setNewKind] = useState<'Inbound' | 'Outbound'>('Inbound')
  const [forms, setForms] = useState<UnitForm[]>([])
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null)
  const [taskLabels, setTaskLabels] = useState<Record<string, { section_name: string; description: string }>>({})
  const [submissionPreview, setSubmissionPreview] = useState<MyFormSubmission | null>(null)
  const [sectionDisplay, setSectionDisplay] = useState('')
  const [previewPendingBySection, setPreviewPendingBySection] = useState<Record<string, { description: string; location?: string; map_url?: string; instructions?: string }[]>>({})
  const [previewCompletedBySection, setPreviewCompletedBySection] = useState<Record<string, { text: string; note?: string; at?: string }[]>>({})
  const [previewCompletedRows, setPreviewCompletedRows] = useState<Array<{ section: string; task: string; note?: string; at?: string }>>([])
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [archivedCleared, setArchivedCleared] = useState<{ member_user_id: string; sub_task_id: string; cleared_at_timestamp?: string }[]>([])
  const [inboundPendingRows, setInboundPendingRows] = useState<Array<{ formName: string; createdAt?: string; description: string; section: string; location?: string }>>([])
  const [inboundCompletedRows, setInboundCompletedRows] = useState<Array<{ formName: string; createdAt?: string; description: string; section: string; location?: string; instructions?: string; clearedBy?: string }>>([])
  const [subTaskMap, setSubTaskMap] = useState<Record<string, UnitSubTask>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [arrivalDate, setArrivalDate] = useState<string>('')
  const [departureDate, setDepartureDate] = useState<string>('')
  const [selectedUnit, setSelectedUnit] = useState<string>('')
  const [unitOptions, setUnitOptions] = useState<Array<{ id: string; name: string }>>([])
  const [formCompletion, setFormCompletion] = useState<Record<number, { completed: number; total: number }>>({})
  const [mySubmissions, setMySubmissions] = useState<MyFormSubmission[]>([])
  const inboundFormsPendingSummary = useMemo(() => {
    const clearedSet = new Set(memberTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
    const pendingSet = new Set(memberTasks.filter(t => t.status === 'Pending').map(t => t.sub_task_id))
    const list: Array<{ formName: string; status: 'In_Progress' | 'Completed'; completed: number; total: number; sections: string[] }> = []
    for (const f of forms.filter(ff => ff.kind === 'Inbound')) {
      const rc = formCompletion[f.id]
      const total = rc?.total ?? f.task_ids.length
      const completed = rc?.completed ?? 0
      const status = total > 0 && completed === total ? 'Completed' : 'In_Progress'
      if (status === 'Completed') continue
      const sects = new Set<string>()
      for (const tid of f.task_ids) {
        const label = taskLabels[tid]
        const code = label?.section_name || ''
        const name = code ? (sectionDisplayMap[code] || code) : ''
        const isIncomplete = pendingSet.has(tid) || (!clearedSet.has(tid) && !pendingSet.has(tid))
        if (isIncomplete) sects.add(name)
      }
      list.push({ formName: f.name, status, completed, total, sections: Array.from(sects).filter(Boolean) })
    }
    return list
  }, [forms, formCompletion, memberTasks, taskLabels, sectionDisplayMap])

  const pendingListRows = useMemo(() => {
    if (!user) return [] as Array<{ key: string; name: string; unit: string; created: string; formId: number; kind: 'Inbound' }>
    const inboundPending = myInbound.filter(i => {
      const fid = i.form_id ?? (forms.find(f => f.name === i.name && f.kind === 'Inbound')?.id || 0)
      const rc = formCompletion[fid]
      return rc ? (rc.completed < rc.total) : true
    })
    const subsFallback = (!inboundPending.length ? mySubmissions.filter(s => s.kind === 'Inbound').filter(s => {
      const ids = Array.isArray(s.task_ids) ? (s.task_ids || []) : (s.tasks || []).map(t => t.sub_task_id)
      const total = ids.length
      const cleared = new Set(memberTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
      const done = ids.filter((id: string) => cleared.has(id)).length
      return total > 0 && done < total
    }) : [])
    const rows = inboundPending.map(i => ({ key: `in-${i.id}`, name: i.name, unit: user?.unit_id || '', created: i.created_at, formId: i.form_id ?? (forms.find(f => f.name === i.name && f.kind === 'Inbound')?.id || 0), kind: 'Inbound' as const }))
      .concat((subsFallback || []).map(s => ({ key: `sub-${s.id}`, name: s.form_name, unit: s.unit_id, created: s.created_at, formId: s.form_id || (forms.find(f => f.name === s.form_name && f.kind === 'Inbound')?.id || 0), kind: 'Inbound' as const })))
    return rows
  }, [user, myInbound, mySubmissions, forms, formCompletion, memberTasks])

  const createPreview = (form: UnitForm, kind: 'Inbound' | 'Outbound', tasks: { sub_task_id: string; description: string; status: 'Pending' }[]): MyFormSubmission => {
    const preview: MyFormSubmission = {
      id: Date.now(),
      user_id: user!.user_id,
      unit_id: selectedUnit || user!.unit_id,
      form_id: form.id,
      form_name: form.name,
      kind,
      created_at: new Date().toISOString(),
      member: { edipi: user!.edipi, rank: user!.rank, first_name: user!.first_name, last_name: user!.last_name, company_id: user!.company_id, platoon_id: user!.platoon_id },
      tasks,
      arrival_date: kind === 'Inbound' ? (arrivalDate || new Date().toISOString().slice(0,10)) : undefined,
      departure_date: kind === 'Outbound' ? (departureDate || new Date().toISOString().slice(0,10)) : undefined,
    }
    return preview
  }

  const overrideRole = getRoleOverride(user?.user_id || '')?.org_role
  const isSectionLead = !!(normalizeSectionRole(user?.section_role) === 'Section_Reviewer' || normalizeOrgRole(user?.org_role) === 'Section_Manager' || normalizeOrgRole(overrideRole) === 'Section_Manager')

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated || !user) { navigate('/'); return }
      if (user.org_role === 'Member') {
        try {
          const progress = await getProgressByMember(user.user_id)
          setMemberTasks(progress.progress_tasks.map(t => ({ sub_task_id: t.sub_task_id, status: t.status })))
        } catch (err) { console.error(err) }
      }
      if (isSectionLead) {
        try {
          const p = await listPendingForSectionManager(user.user_id, user.unit_id, user.edipi)
          setPendingSection(p)
          const checklist = await getChecklistByUnit(user.unit_id)
          const labels: Record<string, { section_name: string; description: string }> = {}
          for (const sec of checklist.sections) {
            for (const st of sec.sub_tasks) {
              labels[st.sub_task_id] = { section_name: sec.section_name, description: st.description }
            }
          }
          setTaskLabels(labels)
        } catch (err) { console.error(err) }
      }
      // Load member profiles for name resolution
      try {
        const map: Record<string, LocalUserProfile> = {}
        if (import.meta.env.VITE_USE_SUPABASE === '1') {
          try {
            const allUsers = await sbListUsers()
            for (const profile of allUsers) map[profile.user_id] = profile
          } catch (err) { console.error(err) }
        }
        if (Object.keys(map).length === 0) {
          try {
            const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
            for (const entry of index.users) {
              const profile = await fetchJson<LocalUserProfile>(`/${entry.path}`)
              map[profile.user_id] = profile
            }
          } catch (err) { console.error(err) }
        }
        setMemberMap(map)
      } catch (err) { console.error(err) }
      // Load tasks cleared by me
      try {
        const a = await listArchivedForUser(user.user_id, user.unit_id)
        setArchivedCleared(a)
      } catch (err) { console.error(err) }
      const inboundItems = await listMyItems(user.user_id, 'Inbound')
      const outboundItems = await listMyItems(user.user_id, 'Outbound')
      setMyInbound(inboundItems)
      setMyOutbound(outboundItems)
      try {
        const subs = await listSubmissions(user.user_id)
        setMySubmissions(subs)
      } catch (err) { console.error(err) }
      const ruc = (user.unit_id || '').includes('-') ? (user.unit_id || '').split('-')[1] : (user.unit_id || '')
      const unitForms = await listForms(ruc)
      setForms(unitForms)
      const first = unitForms.filter(f => f.kind === 'Inbound')[0]
      setSelectedFormId(first ? first.id : null)
      {
        try {
          const progress = await getProgressByMember(user.user_id)
          const pendingIds = new Set(progress.progress_tasks.filter(t => t.status === 'Pending').map(t => t.sub_task_id))
          const clearedIds = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
          const unitKey = (user.unit_id || '').includes('-') ? (user.unit_id as string).split('-')[1] : (user.unit_id as string)
          const subTasks = await listSubTasks(unitKey)
          const map: Record<string, UnitSubTask> = {}
          for (const st of subTasks) map[st.sub_task_id] = st
          setSubTaskMap(map)
          if (import.meta.env.VITE_USE_SUPABASE === '1') {
            try {
              const rows = await sbListMemberFormCompletion(user.user_id)
              const comp: Record<number, { completed: number; total: number }> = {}
              for (const r of rows) comp[r.form_id] = { completed: r.cleared_count, total: r.total_count }
              setFormCompletion(comp)
            } catch (err) {
              const comp: Record<number, { completed: number; total: number }> = {}
              for (const f of unitForms) {
                const total = f.task_ids.length
                let completed = 0
                for (const tid of f.task_ids) { if (clearedIds.has(tid)) completed++ }
                comp[f.id] = { completed, total }
              }
              setFormCompletion(comp)
            }
          } else {
            const comp: Record<number, { completed: number; total: number }> = {}
            for (const f of unitForms) {
              const total = f.task_ids.length
              let completed = 0
              for (const tid of f.task_ids) { if (clearedIds.has(tid)) completed++ }
              comp[f.id] = { completed, total }
            }
            setFormCompletion(comp)
          }
          const formsInbound = unitForms.filter(f => f.kind === 'Inbound')
          const pRows: Array<{ formName: string; createdAt?: string; description: string; section: string; location?: string }> = []
          for (const f of formsInbound) {
            for (const tid of f.task_ids) {
              if (!pendingIds.has(tid)) continue
              const label = taskLabels[tid]
              const code = label?.section_name || ''
              const sec = code ? (sectionDisplayMap[code] || code) : ''
                  const loc = map[tid]?.location || ''
              pRows.push({ formName: f.name, createdAt: undefined, description: (label?.description || tid), section: sec, location: loc || undefined })
            }
          }
          try {
            const subs = await listSubmissions(user.user_id)
            const inboundSubs = subs.filter(s => s.kind === 'Inbound')
            for (const s of inboundSubs) {
              for (const t of s.tasks) {
                if (t.status === 'Pending') {
                  const label = taskLabels[t.sub_task_id]
                  const code = label?.section_name || ''
                  const sec = code ? (sectionDisplayMap[code] || code) : (subTaskMap[t.sub_task_id]?.section_id ? (sectionDisplayMap[String(subTaskMap[t.sub_task_id]?.section_id)] || '') : '')
                  const loc = subTaskMap[t.sub_task_id]?.location || ''
                  pRows.push({ formName: s.form_name, createdAt: s.created_at, description: (label?.description || t.description || t.sub_task_id), section: sec, location: loc || undefined })
                }
              }
            }
          } catch (err) { console.error(err) }
          if (pRows.length === 0) {
            for (const f of formsInbound) {
              for (const tid of f.task_ids) {
                const label = taskLabels[tid]
                const code = label?.section_name || ''
                const sec = code ? (sectionDisplayMap[code] || code) : ''
                const loc = (map[tid] as any)?.location || ''
                pRows.push({ formName: f.name, createdAt: undefined, description: (label?.description || tid), section: sec, location: loc || undefined })
              }
            }
          }
          setInboundPendingRows(pRows)
          const rows: Array<{ formName: string; createdAt?: string; description: string; section: string; location?: string; instructions?: string; clearedBy?: string }> = []
          for (const tid of Array.from(clearedIds)) {
            const label = taskLabels[tid]
            const code = label?.section_name || ''
            const sec = code ? (sectionDisplayMap[code] || code) : ''
            const entry = (progress.progress_tasks || []).find(t => String(t.sub_task_id) === String(tid)) as any
            const lastLog = Array.isArray(entry?.logs) && entry.logs.length ? entry.logs[entry.logs.length - 1] : undefined
            const loc = map[tid]?.location || ''
            const instr = (map[tid] as any)?.instructions || ''
            const formName = formsInbound.find(ff => ff.task_ids.includes(tid))?.name || 'Inbound'
            rows.push({ formName, createdAt: lastLog?.at, description: (label?.description || tid), section: sec, location: loc || undefined, instructions: instr || undefined, clearedBy: lastLog?.note })
          }
          try {
            const subs = await listSubmissions(user.user_id)
            const inboundSubs = subs.filter(s => s.kind === 'Inbound')
            for (const s of inboundSubs) {
              for (const t of s.tasks) {
                if (t.status === 'Cleared') {
                  const label = taskLabels[t.sub_task_id]
                  const code = label?.section_name || ''
                  const sec = code ? (sectionDisplayMap[code] || code) : (subTaskMap[t.sub_task_id]?.section_id ? (sectionDisplayMap[String(subTaskMap[t.sub_task_id]?.section_id)] || '') : '')
                  const loc = subTaskMap[t.sub_task_id]?.location || ''
                  const instr = subTaskMap[t.sub_task_id]?.instructions || ''
                  rows.push({ formName: s.form_name, createdAt: s.created_at, description: (label?.description || t.description || t.sub_task_id), section: sec, location: loc || undefined, instructions: instr || undefined, clearedBy: '' })
                }
              }
            }
          } catch (err) { console.error(err) }
          setInboundCompletedRows(rows)
        } catch (err) { console.error(err) }
      }
      setLoading(false)
    }
    load()
  }, [isAuthenticated, user, refreshKey])

  useEffect(() => {
    if (!isAuthenticated || !user) return
    if (import.meta.env.VITE_USE_SUPABASE !== '1') return
    const channel = supabase
      .channel('md-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members_progress', filter: `member_user_id=eq.${user.user_id}` }, () => setRefreshKey(k => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'my_form_submissions', filter: `user_id=eq.${user.user_id}` }, () => setRefreshKey(k => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_sub_tasks' }, () => setRefreshKey(k => k + 1))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isAuthenticated, user])

  useEffect(() => {
    const resolveSection = async () => {
      const uid = user?.unit_id
      const secId = user?.platoon_id
      if (!uid || !secId) { setSectionDisplay(''); return }
      try {
        const secs = await listSections(uid)
        const map: Record<string, string> = {}
        for (const s of secs) {
          map[s.section_name] = ((s as any).display_name || s.section_name)
          map[String(s.id)] = ((s as any).display_name || s.section_name)
        }
        setSectionDisplayMap(map)
        const byId = secs.find(s => String(s.id) === String(secId))
        if (byId) { setSectionDisplay(((byId as any).display_name || byId.section_name) || ''); return }
        const byCode = secs.find(s => s.section_name === secId)
        setSectionDisplay(((byCode as any)?.display_name || byCode?.section_name) || '')
      } catch { setSectionDisplay('') }
    }
    resolveSection()
  }, [user?.unit_id, user?.platoon_id])

  useEffect(() => {
    const opts = (UNITS || []).map(u => ({ id: `${u.uic}-${u.ruc}-${u.mcc}`, name: u.unitName }))
    const unique = Array.from(new Map(opts.map(o => [o.id, o])).values())
    setUnitOptions(unique)
    setSelectedUnit(user?.unit_id || unique[0]?.id || '')
  }, [user?.unit_id])

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mb-4"></div>
          <p className="text-gray-400">Loading My Dashboard...</p>
        </div>
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
      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl">
          <div className="flex items-center justify-between border-b border-github-border px-4 py-2">
            <div className="flex">
              <button onClick={() => setActiveTab('inbound')} className={`px-4 py-3 text-sm ${activeTab==='inbound'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Inbound</button>
              <button onClick={() => setActiveTab('outbound')} className={`px-4 py-3 text-sm ${activeTab==='outbound'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Outbound</button>
              
            </div>
            <div>
              <button
                className="px-3 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-sm"
                onClick={() => setCreateOpen(true)}
              >
                Create Form
              </button>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {activeTab === 'inbound' && (
              <div className="space-y-6">
                
                
                <div>
                  <h2 className="text-white text-lg mb-3">Pending</h2>
                  {(myInbound.length || mySubmissions.filter(s => s.kind === 'Inbound').length) ? (
                    <div className="mt-4">
                      <div className="grid grid-cols-6 text-gray-400 text-sm mb-2">
                        <div className="text-left p-2">Form</div>
                        <div className="text-left p-2">Unit</div>
                        <div className="text-left p-2">EDIPI</div>
                        <div className="text-left p-2">Created</div>
                        <div className="text-left p-2">Done/Total</div>
                        <div className="text-left p-2">Action</div>
                      </div>
                    <div className="text-sm">
                      {pendingListRows.length ? pendingListRows.map(ri => (
                          <div key={ri.key} className="grid grid-cols-6 items-center border-t border-github-border text-gray-300">
                            <div className="p-2">{ri.name}</div>
                            <div className="p-2">{ri.unit}</div>
                            <div className="p-2">{user?.edipi || ''}</div>
                            <div className="p-2">{new Date(ri.created).toLocaleDateString()}</div>
                            <div className="p-2">{(() => {
                              const fid = ri.formId
                              const subs = mySubmissions.filter(s => s.form_id === fid && s.kind === ri.kind)
                              const latest = subs.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                              const ids = Array.isArray(latest?.task_ids)
                                ? (latest!.task_ids || [])
                                : (latest?.tasks?.map(t => t.sub_task_id) || (forms.find(f => f.id === fid)?.task_ids || []))
                              const total = ids.length
                              const cleared = new Set(memberTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                              const done = ids.filter((id: string) => cleared.has(id)).length
                              return `${done}/${total}`
                            })()}</div>
                            <div className="p-2">
                              <button
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                onClick={async () => {
                                    if (!user) return
                                    const form = forms.find(f => f.id === ri.formId) || forms.find(f => f.name === ri.name && f.kind === ri.kind)
                                    if (!form) return
                                    let tasks: { sub_task_id: string; description: string; status: 'Pending' }[] = []
                                    try {
                                      const progress = await getProgressByMember(user.user_id)
                                      const clearedSet = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                                      tasks = form.task_ids
                                        .filter(tid => !clearedSet.has(tid))
                                        .map(tid => ({
                                          sub_task_id: tid,
                                          description: (taskLabels[tid]?.description || tid),
                                          status: 'Pending' as const,
                                        }))
                                      const completedSet = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                                      const completedBySection: Record<string, { text: string; note?: string; at?: string }[]> = {}
                                      for (const tid of form.task_ids) {
                                        if (!completedSet.has(tid)) continue
                                        const label = taskLabels[tid]
                                        const secCode = label?.section_name || ''
                                        const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                                        const desc = (label?.description || tid)
                                        const entry = (progress.progress_tasks || []).find(t => String(t.sub_task_id) === String(tid)) as any
                                        const lastLog = Array.isArray(entry?.logs) && entry.logs.length ? entry.logs[entry.logs.length - 1] : undefined
                                        const row = { text: desc, note: lastLog?.note, at: lastLog?.at }
                                        if (!completedBySection[secName]) completedBySection[secName] = []
                                        completedBySection[secName].push(row)
                                      }
                                      setPreviewCompletedBySection(completedBySection)
                                      const consolidated: Array<{ section: string; task: string; note?: string; at?: string }> = []
                                      for (const [sec, rows] of Object.entries(completedBySection)) {
                                        for (const r of rows) consolidated.push({ section: sec, task: r.text, note: r.note, at: r.at })
                                      }
                                      setPreviewCompletedRows(consolidated)
                                    } catch (err) { console.error(err) }
                                    const pendingBySection: Record<string, { description: string; location?: string; map_url?: string; instructions?: string }[]> = {}
                                    for (const t of tasks) {
                                      const label = taskLabels[t.sub_task_id]
                                      const secCode = label?.section_name || ''
                                      const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                                      const st = subTaskMap[t.sub_task_id]
                                      if (!pendingBySection[secName]) pendingBySection[secName] = []
                                      pendingBySection[secName].push({ description: t.description, location: st?.location || '', map_url: (st as any)?.map_url || '', instructions: st?.instructions || '' })
                                    }
                                    setPreviewPendingBySection(pendingBySection)
                                    setSubmissionPreview(createPreview(form, ri.kind, tasks))
                                  }}
                                >
                                  View
                                </button>
                              </div>
                          </div>
                        )) : (
                        inboundPendingRows.length ? (
                          <div className="mt-3">
                            <div className="grid grid-cols-4 text-gray-400 text-sm mb-2">
                              <div className="text-left p-2">Section</div>
                              <div className="text-left p-2">Task</div>
                              <div className="text-left p-2">Location</div>
                              <div className="text-left p-2">Form</div>
                            </div>
                            {inboundPendingRows.map((r, i) => (
                              <div key={`p-${i}`} className="grid grid-cols-4 items-center border-t border-github-border text-gray-300">
                                <div className="p-2">{r.section || ''}</div>
                                <div className="p-2">{r.description}</div>
                                <div className="p-2">{r.location || ''}</div>
                                <div className="p-2">{r.formName}</div>
                              </div>
                            ))}
                          </div>
                        ) : (<div className="text-gray-400 text-sm">None</div>)
                      )}
                  </div>
                    </div>
                  ) : (
                    inboundFormsPendingSummary.length ? (
                      <div className="mt-4">
                        <div className="grid grid-cols-5 text-gray-400 text-sm mb-2">
                          <div className="text-left p-2">Form</div>
                          <div className="text-left p-2">Unit</div>
                          <div className="text-left p-2">Arrival</div>
                          <div className="text-left p-2">Done/Total</div>
                          <div className="text-left p-2">Action</div>
                        </div>
                        <div className="text-sm">
                          {inboundFormsPendingSummary.map((r, i) => (
                            <div key={`sum-${i}`} className="grid grid-cols-5 items-center border-t border-github-border text-gray-300">
                              <div className="p-2">{r.formName}</div>
                              <div className="p-2">{(() => {
                                const fid = forms.find(f => f.name === r.formName && f.kind === 'Inbound')?.id || 0
                                const latest = mySubmissions.filter(s => s.form_id === fid && s.kind === 'Inbound').sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                                return latest?.unit_id || (user?.unit_id || '')
                              })()}</div>
                              <div className="p-2">{(() => {
                                const fid = forms.find(f => f.name === r.formName && f.kind === 'Inbound')?.id || 0
                                const latest = mySubmissions.filter(s => s.form_id === fid && s.kind === 'Inbound').sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                                return latest?.arrival_date || (arrivalDate || new Date().toISOString().slice(0,10))
                              })()}</div>
                              <div className="p-2">{`${r.completed}/${r.total}`}</div>
                              <div className="p-2">
                                <button
                                  className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  onClick={async () => {
                                    if (!user) return
                                    const form = forms.find(f => f.name === r.formName && f.kind === 'Inbound')
                                    if (!form) return
                                    let tasks: { sub_task_id: string; description: string; status: 'Pending' }[] = []
                                    try {
                                      const progress = await getProgressByMember(user.user_id)
                                      const clearedSet = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                                      tasks = form.task_ids
                                        .filter(tid => !clearedSet.has(tid))
                                        .map(tid => ({
                                          sub_task_id: tid,
                                          description: (taskLabels[tid]?.description || tid),
                                          status: 'Pending' as const,
                                        }))
                                      const completedSet = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                                      const completedBySection: Record<string, { text: string; note?: string; at?: string }[]> = {}
                                      for (const tid of form.task_ids) {
                                        if (!completedSet.has(tid)) continue
                                        const label = taskLabels[tid]
                                        const secCode = label?.section_name || ''
                                        const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                                        const desc = (label?.description || tid)
                                        const entry = progress.progress_tasks.find(t => String(t.sub_task_id) === String(tid)) as any
                                        const lastLog = Array.isArray(entry?.logs) && entry.logs.length ? entry.logs[entry.logs.length - 1] : undefined
                                        const row = { text: desc, note: lastLog?.note, at: lastLog?.at }
                                        if (!completedBySection[secName]) completedBySection[secName] = []
                                        completedBySection[secName].push(row)
                                      }
                                      setPreviewCompletedBySection(completedBySection)
                                      const consolidated: Array<{ section: string; task: string; note?: string; at?: string }> = []
                                      for (const [sec, rows] of Object.entries(completedBySection)) {
                                        for (const ro of rows) consolidated.push({ section: sec, task: ro.text, note: ro.note, at: ro.at })
                                      }
                                      setPreviewCompletedRows(consolidated)
                                    } catch (err) { console.error(err) }
                                    const pendingBySection: Record<string, { description: string; location?: string; map_url?: string; instructions?: string }[]> = {}
                                    for (const t of tasks) {
                                      const label = taskLabels[t.sub_task_id]
                                      const secCode = label?.section_name || ''
                                      const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                                      const st = subTaskMap[t.sub_task_id]
                                      if (!pendingBySection[secName]) pendingBySection[secName] = []
                                      pendingBySection[secName].push({ description: t.description, location: st?.location || '', map_url: (st as any)?.map_url || '', instructions: st?.instructions || '' })
                                    }
                                    setPreviewPendingBySection(pendingBySection)
                                    setSubmissionPreview(createPreview(form, 'Inbound', tasks))
                                  }}
                                >
                                  View
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">No inbound items</p>
                    )
                  )}
                </div>
                
                <div className="mt-6">
                  <h2 className="text-white text-lg mb-3">Completed</h2>
                  <div className="mt-4">
                    <div className="grid grid-cols-5 text-gray-400 text-sm mb-2">
                      <div className="text-left p-2">Form</div>
                      <div className="text-left p-2">Unit</div>
                      <div className="text-left p-2">Created</div>
                      <div className="text-left p-2">Done/Total</div>
                      <div className="text-left p-2">Action</div>
                    </div>
                    <div className="text-sm">
                      {(() => {
                        const clearedSet = new Set(memberTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                        const inboundCompleted = myInbound.filter(i => {
                          const fid = i.form_id ?? (forms.find(f => f.name === i.name && f.kind === 'Inbound')?.id || 0)
                          const subs = mySubmissions.filter(s => s.form_id === fid && s.kind === 'Inbound')
                          const latest = subs.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                          const ids = Array.isArray((latest as any)?.task_ids)
                            ? (latest as any).task_ids
                            : (latest?.tasks?.map(t => t.sub_task_id) || (forms.find(f => f.id === fid)?.task_ids || []))
                          const total = ids.length
                          const done = ids.filter((id: string) => clearedSet.has(id)).length
                          return total > 0 && done === total
                        })
                        if (!inboundCompleted.length) return (<div className="text-gray-400 text-sm">None</div>)
                        return inboundCompleted.map(i => (
                          <div key={`in-copy-${i.id}`} className="grid grid-cols-5 items-center border-t border-github-border text-gray-300">
                            <div className="p-2">{i.name}</div>
                            <div className="p-2">{user?.unit_id || ''}</div>
                            <div className="p-2">{new Date(i.created_at).toLocaleDateString()}</div>
                            <div className="p-2">{(() => {
                              const fid = i.form_id ?? (forms.find(f => f.name === i.name && f.kind === 'Inbound')?.id || 0)
                              const subs = mySubmissions.filter(s => s.form_id === fid && s.kind === 'Inbound')
                              const latest = subs.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                              const ids = Array.isArray(latest?.task_ids)
                                ? latest!.task_ids!
                                : (latest?.tasks?.map(t => t.sub_task_id) || (forms.find(f => f.id === fid)?.task_ids || []))
                              const total = ids.length
                              const done = ids.filter((id: string) => clearedSet.has(id)).length
                              return `${done}/${total}`
                            })()}</div>
                            <div className="p-2">
                              <button
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              onClick={async () => {
                                if (!user) return
                                const form = i.form_id ? forms.find(f => f.id === i.form_id) : forms.find(f => f.name === i.name && f.kind === 'Inbound')
                                if (!form) return
                                let tasks: { sub_task_id: string; description: string; status: 'Pending' }[] = []
                                try {
                                  const progress = await getProgressByMember(user.user_id)
                                  const clearedSet = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                                  tasks = form.task_ids
                                    .filter(tid => !clearedSet.has(tid))
                                    .map(tid => ({
                                      sub_task_id: tid,
                                      description: (taskLabels[tid]?.description || tid),
                                      status: 'Pending' as const,
                                    }))
                                  const completedSet = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                                  const completedBySection: Record<string, { text: string; note?: string; at?: string }[]> = {}
                                  for (const tid of form.task_ids) {
                                    if (!completedSet.has(tid)) continue
                                    const label = taskLabels[tid]
                                    const secCode = label?.section_name || ''
                                    const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                                    const desc = (label?.description || tid)
                                    const entry = (progress.progress_tasks || []).find(t => String(t.sub_task_id) === String(tid)) as any
                                    const lastLog = Array.isArray(entry?.logs) && entry.logs.length ? entry.logs[entry.logs.length - 1] : undefined
                                    const row = { text: desc, note: lastLog?.note, at: lastLog?.at }
                                    if (!completedBySection[secName]) completedBySection[secName] = []
                                    completedBySection[secName].push(row)
                                  }
                                  setPreviewCompletedBySection(completedBySection)
                                  const consolidated: Array<{ section: string; task: string; note?: string; at?: string }> = []
                                  for (const [sec, rows] of Object.entries(completedBySection)) {
                                    for (const r of rows) consolidated.push({ section: sec, task: r.text, note: r.note, at: r.at })
                                  }
                                  setPreviewCompletedRows(consolidated)
                                } catch (err) { console.error(err) }
                                const pendingBySection: Record<string, { description: string; location?: string; map_url?: string; instructions?: string }[]> = {}
                                for (const t of tasks) {
                                  const label = taskLabels[t.sub_task_id]
                                  const secCode = label?.section_name || ''
                                  const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                                  const st = subTaskMap[t.sub_task_id]
                                  if (!pendingBySection[secName]) pendingBySection[secName] = []
                                  pendingBySection[secName].push({ description: t.description, location: st?.location || '', map_url: (st as any)?.map_url || '', instructions: st?.instructions || '' })
                                }
                                setPreviewPendingBySection(pendingBySection)
                                setSubmissionPreview(createPreview(form, 'Inbound', tasks))
                              }}
                            >
                              View
                            </button>
                          </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                </div>
                
                
              </div>
            )}
            {activeTab === 'outbound' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-white text-lg mb-3">My Items</h2>
                  {myOutbound.length ? (
                    <div className="mt-4">
                      <div className="grid grid-cols-6 text-gray-400 text-sm mb-2">
                        <div className="text-left p-2">Form</div>
                        <div className="text-left p-2">Unit</div>
                        <div className="text-left p-2">Created</div>
                        <div className="text-left p-2">Done/Total</div>
                        <div className="text-left p-2">Action</div>
                      </div>
                      <div className="text-sm">
                        {myOutbound.map(i => (
                          <div key={`out-${i.id}`} className="grid grid-cols-6 items-center border-t border-github-border text-gray-300">
                            <div className="p-2">{i.name}</div>
                            <div className="p-2">{user?.unit_id || ''}</div>
                            <div className="p-2">{user?.edipi || ''}</div>
                            <div className="p-2">{new Date(i.created_at).toLocaleDateString()}</div>
                            <div className="p-2">{(() => {
                              const fid = i.form_id ?? (forms.find(f => f.name === i.name && f.kind === 'Outbound')?.id || 0)
                              const subs = mySubmissions.filter(s => s.form_id === fid && s.kind === 'Outbound')
                              const latest = subs.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
                              const ids = Array.isArray((latest as any)?.task_ids)
                                ? (latest as any).task_ids
                                : (latest?.tasks?.map(t => t.sub_task_id) || (forms.find(f => f.id === fid)?.task_ids || []))
                              const total = ids.length
                              const cleared = new Set(memberTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                              const done = ids.filter((id: string) => cleared.has(id)).length
                              return `${done}/${total}`
                            })()}</div>
                            <div className="p-2">
                              <button
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                onClick={async () => {
                                    if (!user) return
                                    const form = i.form_id ? forms.find(f => f.id === i.form_id) : forms.find(f => f.name === i.name && f.kind === 'Outbound')
                                    if (!form) return
                                    let tasks: { sub_task_id: string; description: string; status: 'Pending' }[] = []
                                    try {
                                      const progress = await getProgressByMember(user.user_id)
                                      const pendingSet = new Set(progress.progress_tasks.filter(t => t.status === 'Pending').map(t => t.sub_task_id))
                                      tasks = form.task_ids
                                        .filter(tid => pendingSet.has(tid))
                                        .map(tid => ({
                                          sub_task_id: tid,
                                          description: `${(taskLabels[tid]?.section_name ? taskLabels[tid]?.section_name + ' - ' : '')}${(taskLabels[tid]?.description || tid)}`,
                                          status: 'Pending' as const,
                                        }))
                                    } catch (err) { console.error(err) }
                                    // If no pending tasks, leave empty — do not fallback to all tasks
                                    setSubmissionPreview(createPreview(form, 'Outbound', tasks))
                                  }}
                                >
                                  View
                                </button>
                              </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No outbound items</p>
                  )}
                </div>
                <div>
                  <h2 className="text-white text-lg mb-3">Tasks I Cleared</h2>
                  {archivedCleared.length ? (
                    <div className="space-y-4">
                      {archivedCleared.map(item => {
                        const m = memberMap[item.member_user_id]
                        const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : item.member_user_id
                        return (
                          <div key={`${item.member_user_id}-${item.sub_task_id}`} className="border border-github-border rounded">
                            <div className="px-3 py-2 border-b border-github-border text-white text-sm">{name}</div>
                            <ul className="p-3 space-y-1 text-sm text-gray-300">
                              <li>{item.sub_task_id}</li>
                              <li>{item.cleared_at_timestamp || '—'}</li>
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No cleared tasks</p>
                  )}
                </div>
              </div>
            )}
            
            
          </div>
        </div>

        {createOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="w-full max-w-md bg-black border border-github-border rounded-xl p-6">
              <h3 className="text-white text-lg mb-4">Create Item</h3>
              <div className="grid grid-cols-1 gap-3">
                <select value={newKind} onChange={e => {
                  const k = e.target.value as any
                  setNewKind(k)
                  const first = forms.filter(f => f.kind === k)[0]
                  setSelectedFormId(first ? first.id : null)
                  if (k === 'Inbound') { setArrivalDate(new Date().toISOString().slice(0,10)); setDepartureDate('') } else { setDepartureDate(new Date().toISOString().slice(0,10)); setArrivalDate('') }
                }} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                </select>
                <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                  <option value="">Select unit</option>
                  {unitOptions.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
                </select>
                {newKind === 'Inbound' && (
                  <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                )}
                {newKind === 'Outbound' && (
                  <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white" />
                )}
                <select value={selectedFormId ?? ''} onChange={e => setSelectedFormId(Number(e.target.value) || null)} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                  <option value="">Select form</option>
                  {forms.filter(f => f.kind === newKind).map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <div className="max-h-40 overflow-auto space-y-2">
                  {(() => {
                    const form = forms.find(f => f.id === selectedFormId)
                    if (!form) return null
                    return form.task_ids.map(tid => {
                      const label = taskLabels[tid]
                      const secCode = label?.section_name || ''
                      const secName = secCode ? (sectionDisplayMap[secCode] || secCode) : ''
                      const text = [secName, (label?.description || tid)].filter(Boolean).join(' - ')
                      return (
                        <div key={tid} className="text-sm text-gray-300">{text}</div>
                      )
                    })
                  })()}
                </div>
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                <button onClick={async () => {
                  if (!user || !selectedFormId) return
                  const form = forms.find(f => f.id === selectedFormId)
                  if (!form) return
                  await createMyItem(user.user_id, form.name, newKind, form.id)
                  const tasks = form.task_ids.map(tid => ({ sub_task_id: tid, description: (taskLabels[tid]?.description || tid), status: 'Pending' as const }))
                  const submission: any = {
                    user_id: user.user_id,
                    unit_id: selectedUnit || user.unit_id,
                    form_id: form.id,
                    form_name: form.name,
                    kind: newKind,
                    member: { edipi: user.edipi, rank: user.rank, first_name: user.first_name, last_name: user.last_name, company_id: user.company_id, platoon_id: user.platoon_id },
                    tasks,
                    task_ids: form.task_ids,
                    completed_count: 0,
                    total_count: form.task_ids.length,
                    status: 'In_Progress'
                  }
                  if (newKind === 'Inbound') submission.arrival_date = arrivalDate || new Date().toISOString().slice(0,10)
                  if (newKind === 'Outbound') submission.departure_date = departureDate || new Date().toISOString().slice(0,10)
                  try { await createSubmission(submission); setMySubmissions(await listSubmissions(user.user_id)) } catch (err) { console.error(err) }
                  setMyInbound(await listMyItems(user.user_id, 'Inbound'))
                  setMyOutbound(await listMyItems(user.user_id, 'Outbound'))
                  setCreateOpen(false)
                  setNewKind('Inbound')
                  const first = forms.filter(f => f.kind === 'Inbound')[0]
                  setSelectedFormId(first ? first.id : null)
                }} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
                <button onClick={() => setCreateOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
              </div>
            </div>
          </div>
        )}
        {submissionPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-black border border-github-border rounded-xl p-6">
              <h3 className="text-white text-lg mb-4">{submissionPreview.kind} — {submissionPreview.form_name}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                <div><span className="text-gray-400">EDIPI:</span> {submissionPreview.member.edipi}</div>
                <div><span className="text-gray-400">Unit:</span> {submissionPreview.unit_id}</div>
                {submissionPreview.kind === 'Inbound' && (<div><span className="text-gray-400">Arrival:</span> {submissionPreview.arrival_date || ''}</div>)}
                {submissionPreview.kind === 'Outbound' && (<div><span className="text-gray-400">Departure:</span> {submissionPreview.departure_date || ''}</div>)}
                <div className="col-span-2"><span className="text-gray-400">Member:</span> {[submissionPreview.member.rank, [submissionPreview.member.first_name, submissionPreview.member.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ')}</div>
                <div><span className="text-gray-400">Company:</span> {submissionPreview.member.company_id || ''}</div>
                <div><span className="text-gray-400">Section:</span> {sectionDisplay || submissionPreview.member.platoon_id || ''}</div>
              </div>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="text-white text-sm mb-2">Pending</h4>
                  {Object.values(previewPendingBySection).some(arr => (arr && arr.length)) ? (
                    <div className="space-y-4">
                      {Object.entries(previewPendingBySection).map(([sec, items]) => (
                        items.length ? (
                          <div key={sec} className="border border-github-border rounded">
                            <div className="px-3 py-2 border-b border-github-border text-white text-sm">{sec || 'Section'}</div>
                            <ul className="p-3 space-y-1 text-sm text-gray-300">
                              {items.map((d, i) => (
                                <li key={`${sec}-${i}`} className="flex flex-wrap items-center gap-2">
                                  <span>{d.description}</span>
                                  {(() => {
                                    const url = d.map_url || (d.location ? googleMapsLink(d.location) : '')
                                    if (d.location && url) return (<><span className="text-gray-500">|</span><a href={url} target="_blank" rel="noreferrer" className="text-github-blue hover:underline">{d.location}</a></>)
                                    if (d.location) return (<><span className="text-gray-500">|</span><span className="text-gray-400">{d.location}</span></>)
                                    return null
                                  })()}
                                  {d.instructions ? (<><span className="text-gray-500">|</span><span className="text-gray-400">{d.instructions}</span></>) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null
                      ))}
                    </div>
                  ) : (<div className="text-gray-400 text-sm">None</div>)}
                </div>
                <div className="overflow-x-auto">
                  <h4 className="text-white text-sm mb-2">Completed</h4>
                  {previewCompletedRows.length ? (
                    <div className="text-sm">
                      <div className="grid grid-cols-4 text-gray-400 mb-2">
                        <div className="text-left p-2">Section</div>
                        <div className="text-left p-2">Task</div>
                        <div className="text-left p-2">Log</div>
                        <div className="text-left p-2">When</div>
                      </div>
                      {previewCompletedRows.map((r, i) => (
                        <div key={`row-${i}`} className="grid grid-cols-4 items-center border-t border-github-border text-gray-300">
                          <div className="p-2">{r.section || ''}</div>
                          <div className="p-2">{r.task}</div>
                          <div className="p-2">{r.note || ''}</div>
                          <div className="p-2">{r.at || ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : (<div className="text-gray-400 text-sm">None</div>)}
                </div>
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  onClick={async () => {
                    if (!submissionPreview || !user) return
                    const { id, created_at, ...rest } = submissionPreview
                    // Compute snapshot and completion status
                    const ids = submissionPreview.tasks.map(t => t.sub_task_id)
                    let completed = 0
                    try {
                      const progress = await getProgressByMember(user.user_id)
                      const cleared = new Set(progress.progress_tasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
                      completed = ids.filter(id => cleared.has(id)).length
                    } catch (err) { console.error(err) }
                    const total = ids.length
                    const status = completed === total && total > 0 ? 'Completed' : 'In_Progress'
                    const extra: any = { task_ids: ids, completed_count: completed, total_count: total, status }
                    await createSubmission({ ...(rest as any), ...extra })

                    const existingProgress = await getProgressByMember(user.user_id)
                    const existingTaskIds = new Set(existingProgress.progress_tasks.map(t => t.sub_task_id))
                    const newTasks = submissionPreview.tasks
                      .filter(t => !existingTaskIds.has(t.sub_task_id))
                      .map(t => ({
                        sub_task_id: t.sub_task_id,
                        status: t.status,
                        cleared_by_user_id: undefined,
                        cleared_at_timestamp: undefined
                      }))

                    const updatedProgress = {
                      member_user_id: user.user_id,
                      unit_id: user.unit_id,
                      official_checkin_timestamp: existingProgress.official_checkin_timestamp || new Date().toISOString(),
                      progress_tasks: [...existingProgress.progress_tasks, ...newTasks],
                      current_file_sha: ''
                    }

                    const canonical = canonicalize(updatedProgress)
                    const sha = await sha256String(canonical)
                    updatedProgress.current_file_sha = sha

                    if (import.meta.env.VITE_USE_SUPABASE === '1') {
                      try { await sbUpsertProgress(updatedProgress) } catch (err) { console.error('Failed to update member progress:', err) }
                    } else {
                      try { await triggerUpdateProgressDispatch({ progress: updatedProgress }) } catch (err) { console.error('Local dispatch update failed:', err) }
                    }

                    try { window.dispatchEvent(new CustomEvent('progress-updated', { detail: { member_user_id: user.user_id } })) } catch {}

                    setSubmissionPreview(null)
                    setPreviewPendingBySection({})
                    setPreviewCompletedBySection({})
                    try { setMySubmissions(await listSubmissions(user.user_id)) } catch (err) { console.error(err) }
                  }}
                  className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                >
                  Save
                </button>
                <button onClick={() => { setSubmissionPreview(null); setPreviewPendingBySection({}); setPreviewCompletedBySection({}); }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
