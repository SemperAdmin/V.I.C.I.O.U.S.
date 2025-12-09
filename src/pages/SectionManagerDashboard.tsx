import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import HeaderTools from '@/components/HeaderTools'
import { fetchJson, LocalUserProfile, UsersIndexEntry } from '@/services/localDataService'
import { sbListUsers } from '@/services/supabaseDataService'
import { listPendingForSectionManager, listArchivedForUser } from '@/services/localDataService'
import { getRoleOverride } from '@/utils/localUsersStore'
import { listSections } from '@/utils/unitStructure'

export default function SectionManagerDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'inbound' | 'outbound'>('inbound')
  const [inbound, setInbound] = useState<{ member_user_id: string; sub_task_id: string }[]>([])
  const [outbound, setOutbound] = useState<{ member_user_id: string; sub_task_id: string; cleared_at_timestamp?: string }[]>([])
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [sectionLabel, setSectionLabel] = useState('')

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
      const pending = await listPendingForSectionManager(user.user_id, user.unit_id)
      setInbound(pending)
      const archived = await listArchivedForUser(user.user_id, user.unit_id)
      setOutbound(archived)
      const secs = await listSections(user.unit_id)
      const sec = secs.find(s => String(s.id) === String(user.platoon_id))
      setSectionLabel((sec as any)?.display_name || sec?.section_name || 'Section')
    }
    load()
  }, [user])

  const overrideRole = getRoleOverride(user?.edipi || '')?.org_role
  const isReviewer = (user?.section_role === 'Section_Reviewer' || user?.org_role === 'Section_Manager' || overrideRole === 'Section_Manager')
  if (!user || !isReviewer) {
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
            <h1 className="text-xl font-semibold text-white">Section Manager — {sectionLabel}</h1>
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
          </div>
          <div className="p-6">
            {tab === 'inbound' && (
              <div className="space-y-6">
                <div className="text-gray-300">Pending tasks assigned to your section</div>
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Member</th>
                      <th className="text-left p-2">Sub Task ID</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inbound.map(item => {
                      const m = memberMap[item.member_user_id]
                      const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : item.member_user_id
                      return (
                        <tr key={`${item.member_user_id}-${item.sub_task_id}`} className="border-t border-github-border text-gray-300">
                          <td className="p-2">{name}</td>
                          <td className="p-2">{item.sub_task_id}</td>
                          <td className="p-2 flex gap-2">
                            <button
                              onClick={async () => {
                                // TODO: implement approve logic
                                alert(`Approve ${item.sub_task_id} for ${name}`)
                              }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                // TODO: implement reject logic
                                alert(`Reject ${item.sub_task_id} for ${name}`)
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'outbound' && (
              <div className="space-y-6">
                <div className="text-gray-300">Tasks you have cleared</div>
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Member</th>
                      <th className="text-left p-2">Sub Task ID</th>
                      <th className="text-left p-2">Cleared At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outbound.map(item => {
                      const m = memberMap[item.member_user_id]
                      const name = m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : item.member_user_id
                      return (
                        <tr key={`${item.member_user_id}-${item.sub_task_id}`} className="border-t border-github-border text-gray-300">
                          <td className="p-2">{name}</td>
                          <td className="p-2">{item.sub_task_id}</td>
                          <td className="p-2">{item.cleared_at_timestamp || '—'}</td>
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
