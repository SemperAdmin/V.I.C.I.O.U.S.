import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import { fetchJson, LocalUserProfile, UsersIndexEntry, getChecklistByUnit, getProgressByMember } from '@/services/localDataService'
import { sbListUsers, sbListSubmissionsByUnit } from '@/services/supabaseDataService'
import { getRoleOverride } from '@/utils/localUsersStore'
import { normalizeOrgRole } from '@/utils/roles'
import { listSections, listCompanies } from '@/utils/unitStructure'
import { MyFormSubmission, MyFormSubmissionTask } from '@/utils/myFormSubmissionsStore'


export default function UnitManagerDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'inbound' | 'outbound'>('inbound')
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  const [companyDisplayMap, setCompanyDisplayMap] = useState<Record<string, string>>({})
  const [taskLabels, setTaskLabels] = useState<Record<string, { section_name: string; description: string }>>({})
  const [latestInboundMap, setLatestInboundMap] = useState<Record<string, any>>({})
  const [latestOutboundMap, setLatestOutboundMap] = useState<Record<string, any>>({})
  const [unitFormStatus, setUnitFormStatus] = useState<Array<{ user_id: string; edipi?: string; form_name: string; kind: 'Inbound' | 'Outbound'; total: number; cleared: number; status: 'In_Progress' | 'Completed'; created_at?: string; completed_at?: string; arrival_date?: string; departure_date?: string; section?: string; company?: string }>>([])
  const [previewSubmission, setPreviewSubmission] = useState<any | null>(null)
  const [previewPendingBySection, setPreviewPendingBySection] = useState<Record<string, string[]>>({})
  const [previewCompletedRows, setPreviewCompletedRows] = useState<Array<{ section: string; task: string; note?: string; at?: string }>>([])
  const [inboundView, setInboundView] = useState<'Pending' | 'Completed'>('Pending')
  const [outboundView, setOutboundView] = useState<'Pending' | 'Completed'>('Pending')

  // Helper function to handle view details for submissions
  const handleViewDetails = async (
    row: { user_id: string; form_name: string; kind: 'Inbound' | 'Outbound'; created_at?: string },
    member: LocalUserProfile | undefined,
    submission: MyFormSubmission | undefined
  ) => {
    // Use form-scoped task status from the submission
    const submissionTasks: MyFormSubmissionTask[] = submission?.tasks || []
    const pendingSet = new Set(submissionTasks.filter(t => t.status !== 'Cleared').map(t => t.sub_task_id))
    const completedSet = new Set(submissionTasks.filter(t => t.status === 'Cleared').map(t => t.sub_task_id))
    const formName = row.form_name
    const kind = row.kind
    const createdAt = row.created_at || ''
    const memberData = { edipi: member?.edipi || '', rank: member?.rank, first_name: member?.first_name, last_name: member?.last_name, company_id: member?.company_id, platoon_id: member?.platoon_id }
    const tasksIds = submissionTasks.map(t => t.sub_task_id)
    const pendingBySection: Record<string, string[]> = {}
    const allSectionNames = new Set<string>()
    for (const tid of tasksIds) {
      const label = taskLabels[tid]
      const code = label?.section_name || ''
      const name2 = code ? (sectionDisplayMap[code] || code) : ''
      allSectionNames.add(name2)
    }
    for (const nm of allSectionNames) pendingBySection[nm] = []
    for (const tid of tasksIds) {
      if (!pendingSet.has(tid)) continue
      const label = taskLabels[tid]
      const code = label?.section_name || ''
      const name2 = code ? (sectionDisplayMap[code] || code) : ''
      pendingBySection[name2].push(label?.description || tid)
    }
    setPreviewPendingBySection(pendingBySection)
    const completedRows: Array<{ section: string; task: string; note?: string; at?: string }> = []
    // Get global progress for completion logs (historical tracking)
    const progress = await getProgressByMember(row.user_id)
    for (const tid of tasksIds) {
      if (!completedSet.has(tid)) continue
      const label = taskLabels[tid]
      const code = label?.section_name || ''
      const secName = code ? (sectionDisplayMap[code] || code) : ''
      const entry = (progress.progress_tasks || []).find(t => String(t.sub_task_id) === String(tid)) as any
      const lastLog = Array.isArray(entry?.logs) && entry.logs.length ? entry.logs[entry.logs.length - 1] : undefined
      completedRows.push({ section: secName, task: (label?.description || tid), note: lastLog?.note, at: lastLog?.at })
    }
    setPreviewCompletedRows(completedRows)
    setPreviewSubmission({ user_id: row.user_id, unit_id: user?.unit_id, form_name: formName, kind, created_at: createdAt, member: memberData })
  }

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const map: Record<string, LocalUserProfile> = {}
      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        try {
          const allUsers = await sbListUsers()
          for (const profile of allUsers) {
            map[profile.user_id] = profile
          }
        } catch {
        }
      }
      if (Object.keys(map).length === 0) {
        try {
          const index = await fetchJson<{ users: UsersIndexEntry[] }>(`/data/users/users_index.json`)
          for (const entry of index.users) {
            const profile = await fetchJson<LocalUserProfile>(`/${entry.path}`)
            map[profile.user_id] = profile
          }
        } catch {
        }
      }
      setMemberMap(map)

      // Load companies for display mapping
      const companies = await listCompanies(user.unit_id)
      const compDispMap: Record<string, string> = {}
      for (const c of companies) {
        compDispMap[c.company_id] = c.display_name || c.company_id
      }
      setCompanyDisplayMap(compDispMap)

      // Load sections for display mapping
      const secs = await listSections(user.unit_id)
      const dispMap: Record<string, string> = {}
      for (const s of secs) {
        dispMap[s.section_name] = ((s as any).display_name || s.section_name)
        dispMap[String(s.id)] = ((s as any).display_name || s.section_name)
      }
      setSectionDisplayMap(dispMap)

      // Load task labels
      try {
        const checklist = await getChecklistByUnit(user.unit_id)
        const labels: Record<string, { section_name: string; description: string }> = {}
        for (const sec of checklist.sections) {
          for (const st of sec.sub_tasks) {
            labels[st.sub_task_id] = { section_name: sec.section_name, description: st.description }
          }
        }
        setTaskLabels(labels)
      } catch {}

      // Load ALL submissions for the unit (no company filter)
      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        try {
          const unitAllSubs = await sbListSubmissionsByUnit(user.unit_id)

          const inboundSubs = unitAllSubs.filter(s => s.kind === 'Inbound')
          const outboundSubs = unitAllSubs.filter(s => s.kind === 'Outbound')

          // Build latest submission maps
          const latest: Record<string, any> = {}
          for (const s of inboundSubs) {
            const cur = latest[s.user_id]
            const curAt = cur?.created_at || ''
            if (!cur || String(curAt) < String(s.created_at || '')) latest[s.user_id] = s
          }
          setLatestInboundMap(latest)

          const latestOb: Record<string, any> = {}
          for (const s of outboundSubs) {
            const cur = latestOb[s.user_id]
            const curAt = cur?.created_at || ''
            if (!cur || String(curAt) < String(s.created_at || '')) latestOb[s.user_id] = s
          }
          setLatestOutboundMap(latestOb)

          // Build form status rows
          const rows: Array<{ user_id: string; edipi?: string; form_name: string; kind: 'Inbound' | 'Outbound'; total: number; cleared: number; status: 'In_Progress' | 'Completed'; created_at?: string; completed_at?: string; arrival_date?: string; departure_date?: string; section?: string; company?: string }> = []
          for (const s of unitAllSubs) {
            const ids = Array.isArray((s as any).task_ids) ? ((s as any).task_ids || []) : ((s.tasks || []).map((t: any) => t.sub_task_id))
            const total = ids.length
            const submissionClearedSet = new Set((s.tasks || []).filter((t: any) => t.status === 'Cleared').map((t: any) => t.sub_task_id))
            const cleared = ids.filter((id: string) => submissionClearedSet.has(id)).length
            const status: 'In_Progress' | 'Completed' = total > 0 && cleared === total ? 'Completed' : 'In_Progress'
            const p = map[s.user_id]
            const sectionId = p?.platoon_id || (s as any).member?.platoon_id || ''
            const companyId = p?.company_id || (s as any).member?.company_id || ''
            rows.push({
              user_id: s.user_id,
              edipi: map[s.user_id]?.edipi,
              form_name: s.form_name,
              kind: s.kind as any,
              total,
              cleared,
              status,
              created_at: s.created_at,
              completed_at: (s as any)?.completed_at,
              arrival_date: (s as any)?.arrival_date,
              departure_date: (s as any)?.departure_date,
              section: dispMap[String(sectionId)] || String(sectionId),
              company: compDispMap[companyId] || companyId,
            })
          }
          setUnitFormStatus(rows)
        } catch (error) {
          console.error('Failed to load unit forms:', error)
          setLatestInboundMap({})
          setLatestOutboundMap({})
          setUnitFormStatus([])
        }
      } else {
        setLatestInboundMap({})
        setLatestOutboundMap({})
        setUnitFormStatus([])
      }
    }
    load()
  }, [user])

  const overrideRole = getRoleOverride(user?.edipi || '')?.org_role
  const isUnitManager = (normalizeOrgRole(overrideRole) === 'Unit_Manager' || normalizeOrgRole(user?.org_role) === 'Unit_Manager')
  if (!user || !isUnitManager) {
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
            <BrandMark />
            <HeaderTools />
          </div>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-4">
          <h1 className="text-white text-xl font-semibold">Unit Manager</h1>
          <p className="text-gray-400 text-sm">Viewing all members in your unit</p>
        </div>
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
          </div>
          <div className="p-6">
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
                    <div className="text-gray-300">Pending inbound processes in your unit</div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs sm:text-sm">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left p-2">Member</th>
                          <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                          <th className="text-left p-2">Company</th>
                          <th className="text-left p-2">Section</th>
                          <th className="text-left p-2">Form</th>
                          <th className="text-left p-2">Done/Total</th>
                          <th className="text-left p-2">Arrival</th>
                          <th className="text-left p-2">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitFormStatus.filter(row => row.kind === 'Inbound' && row.status !== 'Completed').map(row => {
                          const m = memberMap[row.user_id]
                          const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : row.user_id
                          return (
                            <tr key={`${row.user_id}-${row.form_name}-${row.created_at}`} className="border-t border-github-border text-gray-300 hover:bg-red-900 hover:bg-opacity-30 transition-colors">
                              <td className="p-2 truncate">{[m?.rank, name].filter(Boolean).join(' ')}</td>
                              <td className="p-2 hidden sm:table-cell">{m?.edipi || ''}</td>
                              <td className="p-2">{row.company || ''}</td>
                              <td className="p-2">{row.section || ''}</td>
                              <td className="p-2">{row.form_name}</td>
                              <td className="p-2">{`${row.cleared}/${row.total}`}</td>
                              <td className="p-2">{row.arrival_date || ''}</td>
                              <td className="p-2">
                                <button
                                  className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  onClick={() => handleViewDetails(row, m, latestInboundMap[row.user_id])}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {inboundView === 'Completed' && (
                  <div className="space-y-6">
                    <div className="text-gray-300">Completed inbound processes in your unit</div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs sm:text-sm">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left p-2">Member</th>
                          <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                          <th className="text-left p-2">Company</th>
                          <th className="text-left p-2">Section</th>
                          <th className="text-left p-2">Form</th>
                          <th className="text-left p-2">Completed</th>
                          <th className="text-left p-2">Arrival</th>
                          <th className="text-left p-2">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitFormStatus.filter(row => row.kind === 'Inbound' && row.status === 'Completed').map(row => {
                          const m = memberMap[row.user_id]
                          const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : row.user_id
                          return (
                            <tr key={`${row.user_id}-${row.form_name}-${row.created_at}`} className="border-t border-github-border text-gray-300 hover:bg-red-900 hover:bg-opacity-30 transition-colors">
                              <td className="p-2 truncate">{[m?.rank, name].filter(Boolean).join(' ')}</td>
                              <td className="p-2 hidden sm:table-cell">{m?.edipi || ''}</td>
                              <td className="p-2">{row.company || ''}</td>
                              <td className="p-2">{row.section || ''}</td>
                              <td className="p-2">{row.form_name}</td>
                              <td className="p-2">{new Date((row.completed_at || row.created_at || '')).toLocaleDateString()}</td>
                              <td className="p-2">{row.arrival_date || ''}</td>
                              <td className="p-2">
                                <button
                                  className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  onClick={() => handleViewDetails(row, m, latestInboundMap[row.user_id])}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {previewSubmission && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                <div className="w-full max-w-2xl bg-black border border-github-border rounded-xl p-6">
                  <h3 className="text-white text-lg mb-4">{previewSubmission.kind} — {previewSubmission.form_name}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                    <div><span className="text-gray-400">EDIPI:</span> {previewSubmission.member.edipi}</div>
                    <div><span className="text-gray-400">Unit:</span> {previewSubmission.unit_id}</div>
                    <div className="col-span-2"><span className="text-gray-400">Member:</span> {[previewSubmission.member.rank, [previewSubmission.member.first_name, previewSubmission.member.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ')}</div>
                    <div><span className="text-gray-400">Company:</span> {companyDisplayMap[previewSubmission.member.company_id || ''] || previewSubmission.member.company_id || ''}</div>
                    <div><span className="text-gray-400">Section:</span> {sectionDisplayMap[String(previewSubmission.member.platoon_id || '')] || previewSubmission.member.platoon_id || ''}</div>
                  </div>
                  <div className="mt-6 space-y-6">
                    <div>
                      <h4 className="text-white text-sm mb-2">Pending</h4>
                      {Object.keys(previewPendingBySection).length ? (
                        <div className="space-y-4">
                          {Object.entries(previewPendingBySection).map(([sec, items]) => (
                            <div key={sec} className="border border-github-border rounded">
                              <div className="px-3 py-2 border-b border-github-border text-white text-sm">{sec || 'Section'}</div>
                              <ul className="p-3 space-y-1 text-sm text-gray-300">
                                {items.map((d, i) => (<li key={`${sec}-${i}`}>{d}</li>))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (<div className="text-gray-400 text-sm">None</div>)}
                    </div>
                    <div>
                      <h4 className="text-white text-sm mb-2">Completed</h4>
                      {previewCompletedRows.length ? (
                        <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed text-xs sm:text-sm">
                          <thead className="text-gray-400">
                            <tr>
                              <th className="text-left p-2">Section</th>
                              <th className="text-left p-2">Task</th>
                              <th className="text-left p-2">Log</th>
                              <th className="text-left p-2">When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewCompletedRows.map((r, i) => (
                              <tr key={`row-${i}`} className="border-t border-github-border text-gray-300">
                                <td className="p-2 truncate">{r.section || ''}</td>
                                <td className="p-2 truncate">{r.task}</td>
                                <td className="p-2 truncate">{r.note || ''}</td>
                                <td className="p-2">{r.at || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      ) : (<div className="text-gray-400 text-sm">None</div>)}
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2 justify-end">
                    <button onClick={() => { setPreviewSubmission(null); setPreviewPendingBySection({}); setPreviewCompletedRows([]) }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Close</button>
                  </div>
                </div>
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
                    <div className="text-gray-300">Pending outbound processes in your unit</div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs sm:text-sm">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left p-2">Member</th>
                          <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                          <th className="text-left p-2">Company</th>
                          <th className="text-left p-2">Section</th>
                          <th className="text-left p-2">Form</th>
                          <th className="text-left p-2">Done/Total</th>
                          <th className="text-left p-2">Departure</th>
                          <th className="text-left p-2">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitFormStatus.filter(row => row.kind === 'Outbound' && row.status !== 'Completed').map(row => {
                          const m = memberMap[row.user_id]
                          const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : row.user_id
                          return (
                            <tr key={`${row.user_id}-${row.form_name}-${row.created_at}`} className="border-t border-github-border text-gray-300 hover:bg-red-900 hover:bg-opacity-30 transition-colors">
                              <td className="p-2 truncate">{[m?.rank, name].filter(Boolean).join(' ')}</td>
                              <td className="p-2 hidden sm:table-cell">{m?.edipi || ''}</td>
                              <td className="p-2">{row.company || ''}</td>
                              <td className="p-2">{row.section || ''}</td>
                              <td className="p-2">{row.form_name}</td>
                              <td className="p-2">{`${row.cleared}/${row.total}`}</td>
                              <td className="p-2">{row.departure_date || ''}</td>
                              <td className="p-2">
                                <button
                                  className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  onClick={() => handleViewDetails(row, m, latestOutboundMap[row.user_id])}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {outboundView === 'Completed' && (
                  <div className="space-y-6">
                    <div className="text-gray-300">Completed outbound processes in your unit</div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs sm:text-sm">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left p-2">Member</th>
                          <th className="text-left p-2 hidden sm:table-cell">EDIPI</th>
                          <th className="text-left p-2">Company</th>
                          <th className="text-left p-2">Section</th>
                          <th className="text-left p-2">Form</th>
                          <th className="text-left p-2">Completed</th>
                          <th className="text-left p-2">Departure</th>
                          <th className="text-left p-2">View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitFormStatus.filter(row => row.kind === 'Outbound' && row.status === 'Completed').map(row => {
                          const m = memberMap[row.user_id]
                          const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : row.user_id
                          return (
                            <tr key={`${row.user_id}-${row.form_name}-${row.created_at}`} className="border-t border-github-border text-gray-300 hover:bg-red-900 hover:bg-opacity-30 transition-colors">
                              <td className="p-2 truncate">{[m?.rank, name].filter(Boolean).join(' ')}</td>
                              <td className="p-2 hidden sm:table-cell">{m?.edipi || ''}</td>
                              <td className="p-2">{row.company || ''}</td>
                              <td className="p-2">{row.section || ''}</td>
                              <td className="p-2">{row.form_name}</td>
                              <td className="p-2">{new Date((row.completed_at || row.created_at || '')).toLocaleDateString()}</td>
                              <td className="p-2">{row.departure_date || ''}</td>
                              <td className="p-2">
                                <button
                                  className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  onClick={() => handleViewDetails(row, m, latestOutboundMap[row.user_id])}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
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
