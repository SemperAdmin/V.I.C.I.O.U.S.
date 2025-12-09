import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, ListChecks, Archive, UserCheck, Shield } from 'lucide-react'
import HeaderTools from '@/components/HeaderTools'
import { useAuthStore } from '@/stores/authStore'
import { listPendingForSectionManager, listArchivedForUser, getChecklistByUnit, getProgressByMember } from '@/services/localDataService'
import { canonicalize } from '@/utils/json'
import { sha256String } from '@/utils/crypto'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [pending, setPending] = useState<{ member_user_id: string; sub_task_id: string }[]>([])
  const [archived, setArchived] = useState<{ member_user_id: string; sub_task_id: string; cleared_at_timestamp?: string }[]>([])
  const [memberTasks, setMemberTasks] = useState<{ sub_task_id: string; status: string }[]>([])
  const [signOffPreview, setSignOffPreview] = useState<{ path: string; content: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound')

  useEffect(() => {
    const load = async () => {
      if (!user) {
        navigate('/')
        return
      }
      if (user.org_role === 'Section_Manager') {
        const p = await listPendingForSectionManager(user.user_id, user.unit_id)
        const a = await listArchivedForUser(user.user_id, user.unit_id)
        setPending(p)
        setArchived(a)
      }
      if (user.org_role === 'Member') {
        const progress = await getProgressByMember(user.user_id)
        setMemberTasks(progress.progress_tasks.map(t => ({ sub_task_id: t.sub_task_id, status: t.status })))
      }
      setLoading(false)
    }
    load()
  }, [user, navigate])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <header className="bg-github-gray bg-opacity-10 border-b border-github-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-white">Process Point</h1>
            <HeaderTools />
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl">
          <div className="flex border-b border-github-border">
            <button
              onClick={() => setActiveTab('inbound')}
              className={`px-4 py-3 text-sm ${activeTab === 'inbound' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Inbound
            </button>
            <button
              onClick={() => setActiveTab('outbound')}
              className={`px-4 py-3 text-sm ${activeTab === 'outbound' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Outbound
            </button>
          </div>
          <div className="p-6">
            {activeTab === 'inbound' && (
              <div className="space-y-6">
                {user?.org_role === 'Member' && (
                  <div>
                    <div className="flex items-center mb-4">
                      <UserCheck className="w-6 h-6 text-github-blue mr-2" />
                      <h2 className="text-lg font-semibold text-white">Assigned To Me</h2>
                    </div>
                    {memberTasks.length === 0 ? (
                      <p className="text-gray-400 text-sm">No tasks</p>
                    ) : (
                      <ul className="space-y-2">
                        {memberTasks.map((t, i) => (
                          <li key={i} className="text-sm text-gray-300">{t.sub_task_id} • {t.status}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {user?.org_role === 'Section_Manager' && (
                  <div>
                    <div className="flex items-center mb-4">
                      <ListChecks className="w-6 h-6 text-github-blue mr-2" />
                      <h2 className="text-lg font-semibold text-white">Pending Actions</h2>
                    </div>
                    {pending.length === 0 ? (
                      <p className="text-gray-400 text-sm">No pending actions</p>
                    ) : (
                      <ul className="space-y-2">
                        {pending.map((p, i) => (
                          <li key={`${p.member_user_id}-${p.sub_task_id}-${i}`} className="flex items-center justify-between text-sm text-gray-300">
                            <span>Member {p.member_user_id} • Task {p.sub_task_id}</span>
                            <button
                              onClick={async () => {
                                const checklist = await getChecklistByUnit(user!.unit_id)
                                const taskDef = checklist.sections.flatMap(s => s.sub_tasks).find(st => st.sub_task_id === p.sub_task_id)
                                if (p.member_user_id === user!.user_id && taskDef && taskDef.responsible_user_id.includes(user!.user_id)) {
                                  alert('Guardrail: cannot sign-off your own task when you are the POC')
                                  return
                                }
                                const progress = await getProgressByMember(p.member_user_id)
                                const currentSha = progress.current_file_sha
                                const computedSha = await sha256String(canonicalize(progress))
                                if (currentSha !== computedSha) {
                                  alert('Conflict detected. Please refresh progress data.')
                                  return
                                }
                                const now = new Date().toISOString()
                                const idx = progress.progress_tasks.findIndex(t => t.sub_task_id === p.sub_task_id)
                                if (idx === -1) progress.progress_tasks.push({ sub_task_id: p.sub_task_id, status: 'Cleared', cleared_by_user_id: user!.user_id, cleared_at_timestamp: now })
                                else {
                                  progress.progress_tasks[idx].status = 'Cleared'
                                  progress.progress_tasks[idx].cleared_by_user_id = user!.user_id
                                  progress.progress_tasks[idx].cleared_at_timestamp = now
                                }
                                const newCanonical = canonicalize(progress)
                                const newSha = await sha256String(newCanonical)
                                progress.current_file_sha = newSha
                                setSignOffPreview({ path: `data/members/progress_${p.member_user_id}.json`, content: progress })
                              }}
                              className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                            >
                              Prepare Sign-Off
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'outbound' && (
              <div className="space-y-6">
                {user?.org_role === 'Member' && (
                  <div>
                    <div className="flex items-center mb-4">
                      <Archive className="w-6 h-6 text-github-blue mr-2" />
                      <h2 className="text-lg font-semibold text-white">My Actions</h2>
                    </div>
                    <p className="text-gray-400 text-sm">No outbound actions recorded</p>
                  </div>
                )}
                {user?.org_role === 'Section_Manager' && (
                  <div>
                    <div className="flex items-center mb-4">
                      <Archive className="w-6 h-6 text-github-blue mr-2" />
                      <h2 className="text-lg font-semibold text-white">Archived Clearances</h2>
                    </div>
                    {archived.length === 0 ? (
                      <p className="text-gray-400 text-sm">No archived clearances</p>
                    ) : (
                      <ul className="space-y-2">
                        {archived.map((a, i) => (
                          <li key={`${a.member_user_id}-${a.sub_task_id}-${i}`} className="text-sm text-gray-300">Member {a.member_user_id} • Task {a.sub_task_id}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {signOffPreview && (
          <div className="mt-6 bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Sign-Off Preview</h3>
            <p className="text-gray-400 text-sm mb-3">{signOffPreview.path}</p>
            <pre className="text-xs text-gray-300 overflow-auto max-h-64">{JSON.stringify(signOffPreview.content, null, 2)}</pre>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => alert('Submit would trigger a secure workflow. Use Create to download the JSON for this PoC.')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Submit
              </button>
              
              <button
                onClick={() => setSignOffPreview(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
