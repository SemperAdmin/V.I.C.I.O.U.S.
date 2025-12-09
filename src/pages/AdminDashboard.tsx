import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { sbListUnitAdmins, sbUpsertUnitAdmin, sbRemoveUnitAdmin, sbPromoteUserToUnitAdmin } from '@/services/adminService'
import { sbGetUserByEdipi } from '@/services/supabaseDataService'
import HeaderTools from '@/components/HeaderTools'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [units, setUnits] = useState<any[]>([])
  const [admins, setAdmins] = useState<Array<{ unit_key: string; unit_name: string; admin_user_id: string }>>([])
  const [assignEdipi, setAssignEdipi] = useState<Record<string, string>>({})
  const [adminProfiles, setAdminProfiles] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<'assigned' | 'unassigned'>('assigned')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const mod: any = await import('@/utils/units')
        const list = (mod.UNITS || mod.units || mod.default || mod.getAllUnits?.() || []) as any[]
        const normalized = list.map((u: any) => {
          const uic = u.uic || ''
          const ruc = u.ruc || ''
          const mcc = u.mcc || ''
          const unit_key = [uic, ruc, mcc].filter(Boolean).join('-')
          const unit_name = u.unitName || u.name || ''
          return { unit_key, unit_name, uic, ruc, mcc }
        })
        const unique = new Map<string, any>()
        for (const u of normalized) {
          const key = `${u.unit_key}`
          if (!unique.has(key)) unique.set(key, u)
        }
        setUnits(Array.from(unique.values()))
        const a = await sbListUnitAdmins()
        setAdmins(a)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const loadProfiles = async () => {
      const edipis = Array.from(new Set(admins.map(a => a.admin_user_id).filter(Boolean)))
      const map: Record<string, any> = {}
      for (const e of edipis) {
        const u = await sbGetUserByEdipi(e)
        if (u) map[e] = u
      }
      setAdminProfiles(map)
    }
    loadProfiles()
  }, [admins])

  const filtered = units.filter(u => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      (u.unit_name || '').toLowerCase().startsWith(q) ||
      (u.unit_key || '').toLowerCase().startsWith(q) ||
      (u.uic || '').toLowerCase().startsWith(q) ||
      (u.ruc || '').toLowerCase().startsWith(q) ||
      (u.mcc || '').toLowerCase().startsWith(q)
    )
  })

  const getAdminFor = (unit_key: string) => admins.find(a => a.unit_key === unit_key)?.admin_user_id || ''
  const getAdminName = (edipi: string) => {
    const p = adminProfiles[edipi]
    if (!p) return ''
    return [p.first_name, p.last_name].filter(Boolean).join(' ')
  }

  if (!user || !(user.edipi === '1402008233' || user.org_role === 'App_Admin')) {
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
            <h1 className="text-xl font-semibold text-white">App Admin</h1>
            <HeaderTools />
          </div>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
          <div className="flex border-b border-github-border mb-4">
            <button
              onClick={() => setTab('assigned')}
              className={`px-4 py-3 text-sm ${tab === 'assigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Assigned
            </button>
            <button
              onClick={() => setTab('unassigned')}
              className={`px-4 py-3 text-sm ${tab === 'unassigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Unassigned
            </button>
          </div>
          <div className="flex items-center mb-4">
            <input
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
              placeholder="Search by name/UIC/RUC/MCC"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
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
                  {(tab === 'assigned' ? filtered.filter(u => !!getAdminFor(u.unit_key)) : filtered.filter(u => !getAdminFor(u.unit_key))).map(u => (
                    <tr key={u.unit_key} className="border-t border-github-border text-gray-300">
                      <td className="p-2">
                        <div>{u.unit_name}</div>
                        {getAdminFor(u.unit_key) && (
                          <div className="text-xs text-gray-400">Admin: {getAdminName(getAdminFor(u.unit_key))} ({getAdminFor(u.unit_key)})</div>
                        )}
                      </td>
                      <td className="p-2">{u.uic}</td>
                      <td className="p-2">{u.ruc}</td>
                      <td className="p-2">{u.mcc}</td>
                      <td className="p-2">
                        <input
                          value={assignEdipi[u.unit_key] ?? getAdminFor(u.unit_key)}
                          onChange={(e) => setAssignEdipi(prev => ({ ...prev, [u.unit_key]: e.target.value }))}
                          placeholder="EDIPI"
                          className="w-40 px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                      </td>
                      <td className="p-2 flex gap-2">
                        <button
                          onClick={async () => {
                            const edipi = (assignEdipi[u.unit_key] ?? '').trim()
                            if (!edipi) return
                      await sbUpsertUnitAdmin(u.unit_key, u.unit_name, edipi)
                      await sbPromoteUserToUnitAdmin(edipi, u.unit_key)
                      const a = await sbListUnitAdmins()
                      setAdmins(a)
                      setAssignEdipi(prev => ({ ...prev, [u.unit_key]: '' }))
                    }}
                          className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                        >
                          Assign
                        </button>
                        {getAdminFor(u.unit_key) && (
                          <button
                            onClick={async () => {
                              await sbRemoveUnitAdmin(u.unit_key)
                              const a = await sbListUnitAdmins()
                              setAdmins(a)
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
