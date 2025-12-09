import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeaderTools from '@/components/HeaderTools'
import { useAuthStore } from '@/stores/authStore'
import { listPendingForSectionManager, getProgressByMember, getChecklistByUnit } from '@/services/localDataService'
import { listSections } from '@/utils/unitStructure'
import { listForms, UnitForm } from '@/utils/formsStore'
import { getRoleOverride } from '@/utils/localUsersStore'
import { listMyItems, createMyItem, MyItem } from '@/utils/myItemsStore'
import { createSubmission, MyFormSubmission } from '@/utils/myFormSubmissionsStore'
import { sbUpsertProgress } from '@/services/supabaseDataService'
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

  const overrideRole = getRoleOverride(user?.edipi || '')?.org_role
  const isSectionLead = !!(user?.section_role === 'Section_Reviewer' || user?.org_role === 'Section_Manager' || overrideRole === 'Section_Manager')

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated || !user) { navigate('/'); return }
      if (user.org_role === 'Member') {
        try {
          const progress = await getProgressByMember(user.user_id)
          setMemberTasks(progress.progress_tasks.map(t => ({ sub_task_id: t.sub_task_id, status: t.status })))
        } catch {}
      }
      if (isSectionLead) {
        try {
          const p = await listPendingForSectionManager(user.user_id, user.unit_id)
          setPendingSection(p)
          const checklist = await getChecklistByUnit(user.unit_id)
          const labels: Record<string, { section_name: string; description: string }> = {}
          for (const sec of checklist.sections) {
            for (const st of sec.sub_tasks) {
              labels[st.sub_task_id] = { section_name: sec.section_name, description: st.description }
            }
          }
          setTaskLabels(labels)
        } catch {}
      }
      const inboundItems = await listMyItems(user.user_id, 'Inbound')
      const outboundItems = await listMyItems(user.user_id, 'Outbound')
      setMyInbound(inboundItems)
      setMyOutbound(outboundItems)
      const ruc = (user.unit_id || '').includes('-') ? (user.unit_id || '').split('-')[1] : (user.unit_id || '')
      const unitForms = await listForms(ruc)
      setForms(unitForms)
      const first = unitForms.filter(f => f.kind === 'Inbound')[0]
      setSelectedFormId(first ? first.id : null)
      setLoading(false)
    }
    load()
  }, [isAuthenticated, user])

  useEffect(() => {
    const resolveSection = async () => {
      const uid = user?.unit_id
      const secId = user?.platoon_id
      if (!uid || !secId) { setSectionDisplay(''); return }
      try {
        const secs = await listSections(uid)
        const byId = secs.find(s => String(s.id) === String(secId))
        if (byId) { setSectionDisplay(((byId as any).display_name || byId.section_name) || ''); return }
        const byCode = secs.find(s => s.section_name === secId)
        setSectionDisplay(((byCode as any)?.display_name || byCode?.section_name) || '')
      } catch { setSectionDisplay('') }
    }
    resolveSection()
  }, [user?.unit_id, user?.platoon_id])

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
            <h1 className="text-xl font-semibold text-white">Welcome{user?.first_name ? `, ${user.first_name}` : ''}</h1>
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
            <button onClick={() => { setNewKind('Inbound'); setSelectedFormId(forms.filter(f => f.kind==='Inbound')[0]?.id || null); setCreateOpen(true) }} className="px-3 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Create New</button>
          </div>
          <div className="p-6 space-y-6">
            {activeTab === 'inbound' && (
              <div className="space-y-6">
                {user?.org_role === 'Member' && (
                  <div>
                    <h2 className="text-white text-lg mb-3">Assigned To Me</h2>
                    {memberTasks.length ? (
                      <ul className="space-y-2">
                        {memberTasks.map((t, i) => (
                          <li key={i} className="text-sm text-gray-300">{t.sub_task_id} • {t.status}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-sm">No tasks</p>
                    )}
                  </div>
                )}
                <div>
                  <h2 className="text-white text-lg mb-3">My Items</h2>
                  {myInbound.length ? (
                    <ul className="space-y-2">
                      {myInbound.map(i => (
                        <li
                          key={i.id}
                          className="text-sm text-gray-300 cursor-pointer hover:text-white"
                          onClick={async () => {
                            if (!user) return
                            const form = i.form_id ? forms.find(f => f.id === i.form_id) : forms.find(f => f.name === i.name && f.kind === 'Inbound')
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
                            } catch {}
                            if (tasks.length === 0) {
                              tasks = form.task_ids.map(tid => ({
                                sub_task_id: tid,
                                description: `${(taskLabels[tid]?.section_name ? taskLabels[tid]?.section_name + ' - ' : '')}${(taskLabels[tid]?.description || tid)}`,
                                status: 'Pending' as const,
                              }))
                            }
                            const preview: MyFormSubmission = {
                              id: Date.now(),
                              user_id: user.user_id,
                              unit_id: user.unit_id,
                              form_id: form.id,
                              form_name: form.name,
                              kind: 'Inbound',
                              created_at: new Date().toISOString(),
                              member: { edipi: user.edipi, rank: user.rank, first_name: user.first_name, last_name: user.last_name, company_id: user.company_id, platoon_id: user.platoon_id },
                              tasks,
                            }
                            setSubmissionPreview(preview)
                          }}
                        >
                          {i.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm">No inbound items</p>
                  )}
                </div>
                
              </div>
            )}
            {activeTab === 'outbound' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-white text-lg mb-3">My Items</h2>
                  {myOutbound.length ? (
                    <ul className="space-y-2">
                      {myOutbound.map(i => (
                        <li
                          key={i.id}
                          className="text-sm text-gray-300 cursor-pointer hover:text-white"
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
                            } catch {}
                            if (tasks.length === 0) {
                              tasks = form.task_ids.map(tid => ({
                                sub_task_id: tid,
                                description: `${(taskLabels[tid]?.section_name ? taskLabels[tid]?.section_name + ' - ' : '')}${(taskLabels[tid]?.description || tid)}`,
                                status: 'Pending' as const,
                              }))
                            }
                            const preview: MyFormSubmission = {
                              id: Date.now(),
                              user_id: user.user_id,
                              unit_id: user.unit_id,
                              form_id: form.id,
                              form_name: form.name,
                              kind: 'Outbound',
                              created_at: new Date().toISOString(),
                              member: { edipi: user.edipi, rank: user.rank, first_name: user.first_name, last_name: user.last_name, company_id: user.company_id, platoon_id: user.platoon_id },
                              tasks,
                            }
                            setSubmissionPreview(preview)
                          }}
                        >
                          {i.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm">No outbound items</p>
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
                }} className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white">
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                </select>
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
                    return form.task_ids.map(tid => (
                      <div key={tid} className="text-sm text-gray-300">{tid}</div>
                    ))
                  })()}
                </div>
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                <button onClick={async () => {
                  if (!user || !selectedFormId) return
                  const form = forms.find(f => f.id === selectedFormId)
                  if (!form) return
                  await createMyItem(user.user_id, form.name, newKind, form.id)
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
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-6">
              <h3 className="text-white text-lg mb-4">Form Preview — {submissionPreview.form_name}</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div>EDIPI: {submissionPreview.member.edipi}</div>
                <div>Member: {[submissionPreview.member.rank, [submissionPreview.member.first_name, submissionPreview.member.last_name].filter(Boolean).join(' ')].filter(Boolean).join(' ')}</div>
                <div>Unit: {submissionPreview.unit_id}</div>
                <div>Company: {submissionPreview.member.company_id || ''}</div>
              <div>Section: {sectionDisplay || submissionPreview.member.platoon_id || ''}</div>
              </div>
              <div className="mt-4">
                <h4 className="text-white text-sm mb-2">Pending Tasks</h4>
                <ul className="space-y-2 text-sm text-gray-300 max-h-40 overflow-auto">
                  {submissionPreview.tasks.length ? submissionPreview.tasks.map(t => (
                    <li key={t.sub_task_id}>{t.description}</li>
                  )) : (<li>None</li>)}
                </ul>
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  onClick={async () => {
                    if (!submissionPreview || !user) return
                    const { id, created_at, ...rest } = submissionPreview
                    const saved = createSubmission(rest)

                    // Update member progress in Supabase when VITE_USE_SUPABASE is enabled
                    if (import.meta.env.VITE_USE_SUPABASE === '1') {
                      try {
                        // Get existing progress or create new
                        const existingProgress = await getProgressByMember(user.user_id)

                        // Merge new tasks with existing ones (avoid duplicates)
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

                        // Calculate SHA for integrity
                        const canonical = canonicalize(updatedProgress)
                        const sha = await sha256String(canonical)
                        updatedProgress.current_file_sha = sha

                        await sbUpsertProgress(updatedProgress)
                      } catch (err) {
                        console.error('Failed to update member progress:', err)
                      }
                    }

                    setSubmissionPreview(null)
                  }}
                  className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                >
                  Save
                </button>
                <button onClick={() => setSubmissionPreview(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
