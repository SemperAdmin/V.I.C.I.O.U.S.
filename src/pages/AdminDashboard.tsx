import React, { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { sbListUnitAdmins, sbUpsertUnitAdmin, sbRemoveUnitAdmin, sbPromoteUserToUnitAdmin, sbListSponsorshipCoordinators, type SponsorshipCoordinator } from '@/services/adminService'
import { sbGetUserByEdipi, sbListUsers } from '@/services/supabaseDataService'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import { normalizeOrgRole } from '@/utils/roles'
import { listSections } from '@/utils/unitStructure'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [units, setUnits] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [admins, setAdmins] = useState<Array<{ unit_key: string; unit_name: string; admin_user_id: string; ruc?: string }>>([])
  const [assignEdipi, setAssignEdipi] = useState<Record<string, string>>({})
  const [adminProfiles, setAdminProfiles] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<'units' | 'users'>('units')
  const [loading, setLoading] = useState(true)
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [addingUnit, setAddingUnit] = useState<string | null>(null)
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [sponsorshipCoordinators, setSponsorshipCoordinators] = useState<SponsorshipCoordinator[]>([])
  const [unitSearchQuery, setUnitSearchQuery] = useState('')
  const [assigningUnitAdmin, setAssigningUnitAdmin] = useState(false)

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
        // Load sponsorship coordinators
        const coords = await sbListSponsorshipCoordinators()
        setSponsorshipCoordinators(coords)
        // Load all users
        const users = await sbListUsers()
        setAllUsers(users)
        // Load sections for all unique unit_ids to get display names
        const unitIds = Array.from(new Set(users.map(u => u.unit_id).filter(Boolean)))
        const dispMap: Record<string, string> = {}
        for (const uid of unitIds) {
          try {
            const secs = await listSections(uid)
            for (const s of secs) {
              dispMap[String(s.id)] = (s as any).display_name || s.section_name
              dispMap[s.section_name] = (s as any).display_name || s.section_name
            }
          } catch {}
        }
        setSectionDisplayMap(dispMap)
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

  const filteredUsers = allUsers.filter(u => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return true
    return (
      (u.edipi || '').toLowerCase().includes(q) ||
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.last_name || '').toLowerCase().includes(q) ||
      (u.rank || '').toLowerCase().includes(q) ||
      (u.company_id || '').toLowerCase().includes(q) ||
      (u.unit_id || '').toLowerCase().includes(q) ||
      (u.org_role || '').toLowerCase().includes(q)
    )
  })

  const getAdminFor = (unit_key: string) => admins.find(a => a.unit_key === unit_key)?.admin_user_id || ''
  const getAdminName = (edipi: string) => {
    const p = adminProfiles[edipi]
    if (!p) return ''
    return [p.first_name, p.last_name].filter(Boolean).join(' ')
  }

  // Get all units a user is admin of
  const getUserAdminUnits = (edipi: string) => {
    return admins.filter(a => a.admin_user_id === edipi)
  }

  // Check if user is a sponsorship coordinator and get their RUCs
  const getUserSponsorshipCoordinatorRucs = (edipi: string) => {
    return sponsorshipCoordinators.filter(c => c.coordinator_edipi === edipi).map(c => c.ruc)
  }

  // Filter units for the searchable dropdown
  const filteredUnitsForDropdown = units.filter(u => {
    const q = unitSearchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      (u.unit_name || '').toLowerCase().includes(q) ||
      (u.unit_key || '').toLowerCase().includes(q) ||
      (u.uic || '').toLowerCase().includes(q) ||
      (u.ruc || '').toLowerCase().includes(q)
    )
  })

  // Handle assigning user as Unit Admin
  const handleAssignUnitAdmin = async (userEdipi: string, unit: any) => {
    setAssigningUnitAdmin(true)
    try {
      await sbUpsertUnitAdmin(unit.unit_key, unit.unit_name, userEdipi, unit.ruc)
      await sbPromoteUserToUnitAdmin(userEdipi, unit.unit_key)
      const next = await sbListUnitAdmins()
      setAdmins(next)
      setUnitSearchQuery('')
    } catch (error) {
      console.error('Failed to assign unit admin:', error)
      alert('Failed to assign unit admin. Please try again.')
    } finally {
      setAssigningUnitAdmin(false)
    }
  }

  // Handle removing user as Unit Admin from a specific unit
  const handleRemoveUnitAdmin = async (userEdipi: string, unitKey: string) => {
    try {
      await sbRemoveUnitAdmin(unitKey, userEdipi)
      const next = await sbListUnitAdmins()
      setAdmins(next)
    } catch (error) {
      console.error('Failed to remove unit admin:', error)
      alert('Failed to remove unit admin. Please try again.')
    }
  }

  if (!user || !(user.edipi === '1402008233' || normalizeOrgRole(user.org_role) === 'App_Admin')) {
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
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
          <div className="flex border-b border-github-border mb-4">
            <button
              onClick={() => setTab('units')}
              className={`px-4 py-3 text-sm ${tab === 'units' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Units
            </button>
            <button
              onClick={() => setTab('users')}
              className={`px-4 py-3 text-sm ${tab === 'users' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Users
            </button>
          </div>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : tab === 'units' ? (
            <>
              <div className="flex items-center mb-4">
                <input
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                  placeholder="Search by name/UIC/RUC/MCC"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Unit</th>
                      <th className="text-left p-2">UIC</th>
                      <th className="text-left p-2">RUC</th>
                      <th className="text-left p-2">MCC</th>
                      <th className="text-left p-2">Admins</th>
                      <th className="text-left p-2">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => {
                      const uk = u.unit_key
                      const adminsForUnit = admins.filter(a => a.unit_key === uk)
                      const adminChips = adminsForUnit.map(a => {
                        const name = getAdminName(a.admin_user_id)
                        return (
                          <span key={`${uk}-${a.admin_user_id}`} className="inline-flex items-center gap-2 px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white mr-2">
                            {name ? `${name} (${a.admin_user_id})` : a.admin_user_id}
                            <button
                              onClick={async () => {
                                try {
                                  await sbRemoveUnitAdmin(uk, a.admin_user_id)
                                  const next = await sbListUnitAdmins()
                                  setAdmins(next)
                                } catch (error) {
                                  console.error('Failed to remove admin:', error)
                                  alert('Failed to remove admin. Please try again.')
                                }
                              }}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                            >Remove</button>
                          </span>
                        )
                      })
                      return (
                        <tr key={uk} className="border-t border-github-border text-gray-300 hover:bg-[#AD1B3F] transition-colors">
                          <td className="p-2"><div>{u.unit_name}</div></td>
                          <td className="p-2">{u.uic}</td>
                          <td className="p-2">{u.ruc}</td>
                          <td className="p-2">{u.mcc}</td>
                          <td className="p-2">{adminsForUnit.length ? <span>Assigned</span> : <span className="text-gray-500">Unassigned</span>}</td>
                          <td className="p-2">
                            {editingUnit === uk ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2 mb-2">{adminChips}</div>
                                {addingUnit === uk ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={assignEdipi[uk] ?? ''}
                                      onChange={(e) => setAssignEdipi(prev => ({ ...prev, [uk]: e.target.value }))}
                                      placeholder="EDIPI"
                                      className="w-40 px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                                    />
                                    <button
                                      onClick={async () => {
                                        try {
                                          const edipi = (assignEdipi[uk] ?? '').trim()
                                          if (!edipi) return
                                          await sbUpsertUnitAdmin(uk, u.unit_name, edipi, u.ruc)
                                          await sbPromoteUserToUnitAdmin(edipi, uk)
                                          const next = await sbListUnitAdmins()
                                          setAdmins(next)
                                          setAssignEdipi(prev => ({ ...prev, [uk]: '' }))
                                          setAddingUnit(null)
                                        } catch (error) {
                                          console.error('Failed to add admin:', error)
                                          alert('Failed to add admin. Please try again.')
                                        }
                                      }}
                                      className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded"
                                    >
                                      Save
                                    </button>
                                    <button onClick={() => { setAddingUnit(null); setAssignEdipi(prev => ({ ...prev, [uk]: '' })) }} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setAddingUnit(uk)} className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded">Add Admin</button>
                                    <button onClick={() => { setEditingUnit(null); setAddingUnit(null) }} className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded">Done</button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button onClick={() => { setEditingUnit(uk); setAddingUnit(null) }} className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded">Edit</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center mb-4">
                <input
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                  placeholder="Search by name, EDIPI, rank, company, unit, or role"
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                />
              </div>
              <div className="text-gray-400 text-sm mb-2">{filteredUsers.length} users</div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">EDIPI</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Branch</th>
                      <th className="text-left p-2">MOS</th>
                      <th className="text-left p-2">Unit</th>
                      <th className="text-left p-2">Company</th>
                      <th className="text-left p-2">Section</th>
                      <th className="text-left p-2">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => {
                      const isExpanded = expandedUser === u.edipi
                      const userAdminUnits = getUserAdminUnits(u.edipi)
                      const coordinatorRucs = getUserSponsorshipCoordinatorRucs(u.edipi)
                      const hasCoordinatorPermission = coordinatorRucs.length > 0

                      return (
                        <React.Fragment key={u.user_id || u.edipi}>
                          <tr
                            onClick={() => {
                              setExpandedUser(isExpanded ? null : u.edipi)
                              setUnitSearchQuery('')
                            }}
                            className={`border-t border-github-border text-gray-300 hover:bg-[#AD1B3F] transition-colors cursor-pointer ${isExpanded ? 'bg-[#AD1B3F] bg-opacity-40' : ''}`}
                          >
                            <td className="p-2">
                              <span className="inline-flex items-center gap-2">
                                <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                {u.edipi || ''}
                              </span>
                            </td>
                            <td className="p-2">{[u.first_name, u.middle_initial, u.last_name].filter(Boolean).join(' ')}</td>
                            <td className="p-2">{u.rank || ''}</td>
                            <td className="p-2">{u.branch || ''}</td>
                            <td className="p-2">{u.mos || ''}</td>
                            <td className="p-2">{u.unit_id || ''}</td>
                            <td className="p-2">{u.company_id || ''}</td>
                            <td className="p-2">{sectionDisplayMap[String(u.platoon_id)] || u.platoon_id || ''}</td>
                            <td className="p-2">{u.org_role || ''}</td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${u.edipi}-details`} className="bg-github-gray bg-opacity-10">
                              <td colSpan={9} className="p-4">
                                <div className="space-y-4">
                                  {/* Unit Admin Section */}
                                  <div className="border border-github-border rounded-lg p-4">
                                    <h4 className="text-white font-medium mb-3">Unit Admin Permissions</h4>
                                    {userAdminUnits.length > 0 ? (
                                      <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-2">Currently assigned as Unit Admin for:</p>
                                        <div className="flex flex-wrap gap-2">
                                          {userAdminUnits.map(admin => (
                                            <span
                                              key={admin.unit_key}
                                              className="inline-flex items-center gap-2 px-3 py-1 bg-github-blue bg-opacity-20 border border-github-blue rounded-lg text-white"
                                            >
                                              {admin.unit_name || admin.unit_key}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleRemoveUnitAdmin(u.edipi, admin.unit_key)
                                                }}
                                                className="ml-1 px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                              >
                                                Remove
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-gray-500 text-sm mb-4">Not assigned as Unit Admin for any units</p>
                                    )}

                                    {/* Assign Unit Admin Dropdown */}
                                    <div className="mt-3">
                                      <p className="text-gray-400 text-sm mb-2">Assign as Unit Admin:</p>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={unitSearchQuery}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            setUnitSearchQuery(e.target.value)
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Search units by name, UIC, or RUC..."
                                          className="w-full max-w-md px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                                          disabled={assigningUnitAdmin}
                                        />
                                        {unitSearchQuery && (
                                          <div
                                            className="absolute z-10 w-full max-w-md mt-1 max-h-48 overflow-y-auto bg-github-gray border border-github-border rounded-lg shadow-lg"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {filteredUnitsForDropdown.length > 0 ? (
                                              filteredUnitsForDropdown.slice(0, 10).map(unit => (
                                                <button
                                                  key={unit.unit_key}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleAssignUnitAdmin(u.edipi, unit)
                                                  }}
                                                  className="w-full px-4 py-2 text-left text-white hover:bg-github-blue hover:bg-opacity-30 border-b border-github-border last:border-b-0"
                                                  disabled={assigningUnitAdmin}
                                                >
                                                  <div className="font-medium">{unit.unit_name}</div>
                                                  <div className="text-xs text-gray-400">{unit.unit_key}</div>
                                                </button>
                                              ))
                                            ) : (
                                              <div className="px-4 py-2 text-gray-400">No matching units found</div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sponsorship Coordinator Section */}
                                  <div className="border border-github-border rounded-lg p-4">
                                    <h4 className="text-white font-medium mb-3">Sponsorship Coordinator Permission</h4>
                                    {hasCoordinatorPermission ? (
                                      <div>
                                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-600 bg-opacity-20 border border-green-600 rounded-lg text-green-400">
                                          <span>✓</span> Enabled
                                        </span>
                                        <p className="text-gray-400 text-sm mt-2">
                                          Coordinator for RUC(s): {coordinatorRucs.join(', ')}
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-600 bg-opacity-20 border border-gray-600 rounded-lg text-gray-400">
                                        <span>✗</span> Not Enabled
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
