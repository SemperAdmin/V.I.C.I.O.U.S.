import React, { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { sbListUnitAdmins, sbUpsertUnitAdmin, sbRemoveUnitAdmin, sbPromoteUserToUnitAdmin, sbListSponsorshipCoordinators, type SponsorshipCoordinator } from '@/services/adminService'
import { sbGetUserByEdipi, sbListUsers } from '@/services/supabaseDataService'
import {
  listInstallations,
  createInstallation,
  updateInstallation,
  deleteInstallation,
  addInstaAdmin,
  removeInstaAdmin,
} from '@/services/supabaseInstallationService'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import { normalizeOrgRole } from '@/utils/roles'
import { listSections } from '@/utils/unitStructure'
import type { Installation } from '@/types'

// Type for unit objects used in the dashboard
type Unit = {
  unit_key: string
  unit_name: string
  uic: string
  ruc: string
  mcc: string
}

// Page size options for pagination
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

// Format date helper
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return '-'
  }
}

// Pagination controls component
const PaginationControls = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}: {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) => (
  <div className="flex items-center justify-between mt-4 text-sm">
    <div className="flex items-center gap-2 text-gray-400">
      <span>Show</span>
      <select
        value={pageSize}
        onChange={(e) => {
          onPageSizeChange(Number(e.target.value))
          onPageChange(1)
        }}
        className="px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
      >
        {PAGE_SIZE_OPTIONS.map(size => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <span>of {totalItems}</span>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-40"
      >
        Previous
      </button>
      <span className="text-gray-400">
        Page {currentPage} of {totalPages || 1}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-40"
      >
        Next
      </button>
    </div>
  </div>
)

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [units, setUnits] = useState<Unit[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [admins, setAdmins] = useState<Array<{ unit_key: string; unit_name: string; admin_user_id: string; ruc?: string }>>([])
  const [assignEdipi, setAssignEdipi] = useState<Record<string, string>>({})
  const [adminProfiles, setAdminProfiles] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<'units' | 'users' | 'installations'>('units')
  const [loading, setLoading] = useState(true)
  // Installation state
  const [installations, setInstallations] = useState<Installation[]>([])
  const [installationQuery, setInstallationQuery] = useState('')
  const [editingInstallationId, setEditingInstallationId] = useState<string | null>(null)
  const [creatingInstallation, setCreatingInstallation] = useState(false)
  const [newInstallationName, setNewInstallationName] = useState('')
  const [newInstallationAcronym, setNewInstallationAcronym] = useState('')
  const [newInstallationLocation, setNewInstallationLocation] = useState('')
  const [newInstallationBaseType, setNewInstallationBaseType] = useState('')
  const [newInstallationCommand, setNewInstallationCommand] = useState('')
  const [editInstallationName, setEditInstallationName] = useState('')
  const [editInstallationAcronym, setEditInstallationAcronym] = useState('')
  const [editInstallationLocation, setEditInstallationLocation] = useState('')
  const [editInstallationBaseType, setEditInstallationBaseType] = useState('')
  const [editInstallationCommand, setEditInstallationCommand] = useState('')
  const [addingInstaAdmin, setAddingInstaAdmin] = useState<string | null>(null)
  const [newInstaAdminEdipi, setNewInstaAdminEdipi] = useState('')
  const [installationsPage, setInstallationsPage] = useState(1)
  const [installationsPageSize, setInstallationsPageSize] = useState(10)
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [addingUnit, setAddingUnit] = useState<string | null>(null)
  const [sectionDisplayMap, setSectionDisplayMap] = useState<Record<string, string>>({})
  const [editingUserEdipi, setEditingUserEdipi] = useState<string | null>(null)
  const [sponsorshipCoordinators, setSponsorshipCoordinators] = useState<SponsorshipCoordinator[]>([])
  const [unitSearchQuery, setUnitSearchQuery] = useState('')
  const [assigningUnitAdmin, setAssigningUnitAdmin] = useState(false)
  const [installationSearchQuery, setInstallationSearchQuery] = useState('')
  const [assigningInstaAdmin, setAssigningInstaAdmin] = useState(false)
  // Pagination state
  const [unitsPage, setUnitsPage] = useState(1)
  const [unitsPageSize, setUnitsPageSize] = useState(10)
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize, setUsersPageSize] = useState(10)

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
        // Load installations
        const installs = await listInstallations()
        setInstallations(installs)
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

  // Get installation for a unit
  const getInstallationForUnit = (unitKey: string) => {
    return installations.find(i => i.unit_ids?.includes(unitKey))
  }

  // Pre-compute maps for efficient lookup in render loop
  const userAdminUnitsMap = useMemo(() => {
    const map: Record<string, typeof admins> = {}
    for (const admin of admins) {
      if (!map[admin.admin_user_id]) {
        map[admin.admin_user_id] = []
      }
      map[admin.admin_user_id].push(admin)
    }
    return map
  }, [admins])

  const userCoordinatorRucsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const coord of sponsorshipCoordinators) {
      if (!map[coord.coordinator_edipi]) {
        map[coord.coordinator_edipi] = []
      }
      map[coord.coordinator_edipi].push(coord.ruc)
    }
    return map
  }, [sponsorshipCoordinators])

  // Map user EDIPI to installations they admin
  const userInstaAdminMap = useMemo(() => {
    const map: Record<string, Installation[]> = {}
    for (const inst of installations) {
      for (const edipi of (inst.insta_admin_user_ids || [])) {
        if (!map[edipi]) {
          map[edipi] = []
        }
        map[edipi].push(inst)
      }
    }
    return map
  }, [installations])

  // Filter installations for searchable dropdown
  const filteredInstallationsForDropdown = useMemo(() => {
    const q = installationSearchQuery.trim().toLowerCase()
    if (!q) return installations
    return installations.filter(i => (
      (i.name || '').toLowerCase().includes(q) ||
      (i.acronym || '').toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q) ||
      (i.id || '').toLowerCase().includes(q)
    ))
  }, [installations, installationSearchQuery])

  // Filter units for the searchable dropdown
  const filteredUnitsForDropdown = useMemo(() => {
    const q = unitSearchQuery.trim().toLowerCase()
    if (!q) return units
    return units.filter(u => (
      (u.unit_name || '').toLowerCase().includes(q) ||
      (u.unit_key || '').toLowerCase().includes(q) ||
      (u.uic || '').toLowerCase().includes(q) ||
      (u.ruc || '').toLowerCase().includes(q)
    ))
  }, [units, unitSearchQuery])

  // Paginated units
  const paginatedUnits = useMemo(() => {
    const start = (unitsPage - 1) * unitsPageSize
    return filtered.slice(start, start + unitsPageSize)
  }, [filtered, unitsPage, unitsPageSize])

  const totalUnitsPages = Math.ceil(filtered.length / unitsPageSize)

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize
    return filteredUsers.slice(start, start + usersPageSize)
  }, [filteredUsers, usersPage, usersPageSize])

  const totalUsersPages = Math.ceil(filteredUsers.length / usersPageSize)

  // Filtered installations
  const filteredInstallations = installations.filter(i => {
    const q = installationQuery.trim().toLowerCase()
    if (!q) return true
    return (
      (i.name || '').toLowerCase().includes(q) ||
      (i.acronym || '').toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q) ||
      (i.command || '').toLowerCase().includes(q) ||
      (i.id || '').toLowerCase().includes(q)
    )
  })

  // Paginated installations
  const paginatedInstallations = useMemo(() => {
    const start = (installationsPage - 1) * installationsPageSize
    return filteredInstallations.slice(start, start + installationsPageSize)
  }, [filteredInstallations, installationsPage, installationsPageSize])

  const totalInstallationsPages = Math.ceil(filteredInstallations.length / installationsPageSize)

  // Reset to page 1 when search query changes
  useEffect(() => {
    setUnitsPage(1)
  }, [query])

  useEffect(() => {
    setUsersPage(1)
  }, [userQuery])

  useEffect(() => {
    setInstallationsPage(1)
  }, [installationQuery])

  // Installation handlers
  const handleCreateInstallation = async () => {
    if (!newInstallationName.trim()) return
    try {
      const id = newInstallationAcronym.trim().toUpperCase() || newInstallationName.trim().replace(/\s+/g, '_').toUpperCase().slice(0, 10)
      await createInstallation({
        id,
        name: newInstallationName.trim(),
        acronym: newInstallationAcronym.trim() || undefined,
        location: newInstallationLocation.trim() || undefined,
        base_type: newInstallationBaseType.trim() || undefined,
        command: newInstallationCommand.trim() || undefined,
        unit_ids: [],
        sections: [],
        section_assignments: {},
        insta_admin_user_ids: [],
      })
      setInstallations(await listInstallations())
      setCreatingInstallation(false)
      setNewInstallationName('')
      setNewInstallationAcronym('')
      setNewInstallationLocation('')
      setNewInstallationBaseType('')
      setNewInstallationCommand('')
    } catch (error) {
      console.error('Failed to create installation:', error)
      alert('Failed to create installation. Please try again.')
    }
  }

  const handleUpdateInstallation = async (id: string) => {
    try {
      await updateInstallation(id, {
        name: editInstallationName,
        acronym: editInstallationAcronym || undefined,
        location: editInstallationLocation || undefined,
        base_type: editInstallationBaseType || undefined,
        command: editInstallationCommand || undefined,
      })
      setInstallations(await listInstallations())
      setEditingInstallationId(null)
    } catch (error) {
      console.error('Failed to update installation:', error)
      alert('Failed to update installation. Please try again.')
    }
  }

  const handleDeleteInstallation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this installation?')) return
    try {
      await deleteInstallation(id)
      setInstallations(await listInstallations())
    } catch (error) {
      console.error('Failed to delete installation:', error)
      alert('Failed to delete installation. Please try again.')
    }
  }

  const handleAddInstaAdmin = async (installationId: string, edipi: string) => {
    if (!edipi.trim()) return
    try {
      await addInstaAdmin(installationId, edipi.trim())
      setInstallations(await listInstallations())
      setAddingInstaAdmin(null)
      setNewInstaAdminEdipi('')
    } catch (error) {
      console.error('Failed to add installation admin:', error)
      alert('Failed to add installation admin. Please try again.')
    }
  }

  const handleRemoveInstaAdmin = async (installationId: string, edipi: string) => {
    try {
      await removeInstaAdmin(installationId, edipi)
      setInstallations(await listInstallations())
    } catch (error) {
      console.error('Failed to remove installation admin:', error)
      alert('Failed to remove installation admin. Please try again.')
    }
  }

  // Handle assigning user as Installation Admin from user modal
  const handleAssignInstaAdminFromModal = async (userEdipi: string, inst: Installation) => {
    setAssigningInstaAdmin(true)
    try {
      await addInstaAdmin(inst.id, userEdipi)
      setInstallations(await listInstallations())
      setInstallationSearchQuery('')
    } catch (error) {
      console.error('Failed to assign installation admin:', error)
      alert('Failed to assign installation admin. Please try again.')
    } finally {
      setAssigningInstaAdmin(false)
    }
  }

  // Handle removing user as Installation Admin from user modal
  const handleRemoveInstaAdminFromModal = async (userEdipi: string, installationId: string) => {
    try {
      await removeInstaAdmin(installationId, userEdipi)
      setInstallations(await listInstallations())
    } catch (error) {
      console.error('Failed to remove installation admin:', error)
      alert('Failed to remove installation admin. Please try again.')
    }
  }

  // Handle assigning user as Unit Admin
  const handleAssignUnitAdmin = async (userEdipi: string, unit: Unit) => {
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
            <button
              onClick={() => setTab('installations')}
              className={`px-4 py-3 text-sm ${tab === 'installations' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Installations
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
              <div className="text-gray-400 text-sm mb-2">{filtered.length} units</div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Unit</th>
                      <th className="text-left p-2">UIC</th>
                      <th className="text-left p-2">RUC</th>
                      <th className="text-left p-2">MCC</th>
                      <th className="text-left p-2">Installation</th>
                      <th className="text-left p-2">Admins</th>
                      <th className="text-left p-2">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUnits.map(u => {
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
                          <td className="p-2">
                            {(() => {
                              const inst = getInstallationForUnit(uk)
                              return inst ? (
                                <span className="text-semper-gold">{inst.acronym || inst.name}</span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )
                            })()}
                          </td>
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
              <PaginationControls
                currentPage={unitsPage}
                totalPages={totalUnitsPages}
                pageSize={unitsPageSize}
                totalItems={filtered.length}
                onPageChange={setUnitsPage}
                onPageSizeChange={setUnitsPageSize}
              />
            </>
          ) : (
            <>
              <div className="flex items-center mb-4">
                <input
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                  placeholder="Search by name, EDIPI, rank, unit, or role"
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
                      <th className="text-left p-2">Unit Admin</th>
                      <th className="text-left p-2">Sponsorship Coordinator</th>
                      <th className="text-left p-2">Date Created</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map(u => {
                      const userAdminUnits = userAdminUnitsMap[u.edipi] || []
                      const coordinatorRucs = userCoordinatorRucsMap[u.edipi] || []
                      const hasUnitAdmin = userAdminUnits.length > 0
                      const hasCoordinatorPermission = coordinatorRucs.length > 0

                      return (
                        <tr
                          key={u.user_id || u.edipi}
                          className="border-t border-github-border text-gray-300 hover:bg-[#AD1B3F] transition-colors"
                        >
                          <td className="p-2">{u.edipi || ''}</td>
                          <td className="p-2">{[u.first_name, u.middle_initial, u.last_name].filter(Boolean).join(' ')}</td>
                          <td className="p-2">{u.rank || ''}</td>
                          <td className="p-2">{u.branch || ''}</td>
                          <td className="p-2">{u.mos || ''}</td>
                          <td className="p-2">{u.unit_id || ''}</td>
                          <td className="p-2">
                            {hasUnitAdmin ? (
                              <span className="text-green-400">Yes</span>
                            ) : (
                              <span className="text-gray-500">No</span>
                            )}
                          </td>
                          <td className="p-2">
                            {hasCoordinatorPermission ? (
                              <span className="text-green-400">Yes</span>
                            ) : (
                              <span className="text-gray-500">No</span>
                            )}
                          </td>
                          <td className="p-2">{formatDate(u.created_at_timestamp)}</td>
                          <td className="p-2">{u.org_role || ''}</td>
                          <td className="p-2">
                            <button
                              onClick={() => {
                                setEditingUserEdipi(u.edipi)
                                setUnitSearchQuery('')
                              }}
                              className="px-3 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={usersPage}
                totalPages={totalUsersPages}
                pageSize={usersPageSize}
                totalItems={filteredUsers.length}
                onPageChange={setUsersPage}
                onPageSizeChange={setUsersPageSize}
              />

              {/* Edit User Modal */}
              {editingUserEdipi && (() => {
                const editingUser = allUsers.find(u => u.edipi === editingUserEdipi)
                if (!editingUser) return null
                const userAdminUnits = userAdminUnitsMap[editingUserEdipi] || []
                const coordinatorRucs = userCoordinatorRucsMap[editingUserEdipi] || []
                const userInstaAdmins = userInstaAdminMap[editingUserEdipi] || []

                return (
                  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-github-dark border border-github-border rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-semibold text-white">Edit User Permissions</h3>
                        <button
                          onClick={() => {
                            setEditingUserEdipi(null)
                            setUnitSearchQuery('')
                            setInstallationSearchQuery('')
                          }}
                          className="text-gray-400 hover:text-white text-2xl"
                        >
                          &times;
                        </button>
                      </div>

                      {/* User Info Display */}
                      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-github-gray bg-opacity-20 rounded-lg border border-github-border">
                        <div>
                          <p className="text-gray-400 text-sm">EDIPI</p>
                          <p className="text-white">{editingUser.edipi}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Name</p>
                          <p className="text-white">{[editingUser.first_name, editingUser.middle_initial, editingUser.last_name].filter(Boolean).join(' ')}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Rank</p>
                          <p className="text-white">{editingUser.rank || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Branch</p>
                          <p className="text-white">{editingUser.branch || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">MOS</p>
                          <p className="text-white">{editingUser.mos || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Unit</p>
                          <p className="text-white">{editingUser.unit_id || '-'}</p>
                        </div>
                      </div>

                      {/* Unit Admin Assignment */}
                      <div className="mb-6 p-4 bg-github-gray bg-opacity-10 border border-github-border rounded-lg">
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
                                    onClick={() => handleRemoveUnitAdmin(editingUserEdipi, admin.unit_key)}
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
                              onChange={(e) => setUnitSearchQuery(e.target.value)}
                              placeholder="Search units by name, UIC, or RUC..."
                              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                              disabled={assigningUnitAdmin}
                            />
                            {unitSearchQuery && (
                              <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-github-dark border border-github-border rounded-lg shadow-lg">
                                {filteredUnitsForDropdown.length > 0 ? (
                                  filteredUnitsForDropdown.slice(0, 10).map(unit => (
                                    <button
                                      key={unit.unit_key}
                                      onClick={() => handleAssignUnitAdmin(editingUserEdipi, unit)}
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

                      {/* Installation Admin Assignment */}
                      <div className="mb-6 p-4 bg-github-gray bg-opacity-10 border border-github-border rounded-lg">
                        <h4 className="text-white font-medium mb-3">Installation Admin Permissions</h4>
                        {userInstaAdmins.length > 0 ? (
                          <div className="mb-4">
                            <p className="text-gray-400 text-sm mb-2">Currently assigned as Installation Admin for:</p>
                            <div className="flex flex-wrap gap-2">
                              {userInstaAdmins.map(inst => (
                                <span
                                  key={inst.id}
                                  className="inline-flex items-center gap-2 px-3 py-1 bg-semper-gold bg-opacity-20 border border-semper-gold rounded-lg text-white"
                                >
                                  {inst.acronym || inst.name}
                                  <button
                                    onClick={() => handleRemoveInstaAdminFromModal(editingUserEdipi, inst.id)}
                                    className="ml-1 px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                  >
                                    Remove
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm mb-4">Not assigned as Installation Admin for any installations</p>
                        )}

                        {/* Assign Installation Admin Dropdown */}
                        <div className="mt-3">
                          <p className="text-gray-400 text-sm mb-2">Assign as Installation Admin:</p>
                          <div className="relative">
                            <input
                              type="text"
                              value={installationSearchQuery}
                              onChange={(e) => setInstallationSearchQuery(e.target.value)}
                              placeholder="Search installations by name or acronym..."
                              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-semper-gold"
                              disabled={assigningInstaAdmin}
                            />
                            {installationSearchQuery && (
                              <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-github-dark border border-github-border rounded-lg shadow-lg">
                                {filteredInstallationsForDropdown.length > 0 ? (
                                  filteredInstallationsForDropdown
                                    .filter(inst => !userInstaAdmins.some(ui => ui.id === inst.id))
                                    .slice(0, 10).map(inst => (
                                    <button
                                      key={inst.id}
                                      onClick={() => handleAssignInstaAdminFromModal(editingUserEdipi, inst)}
                                      className="w-full px-4 py-2 text-left text-white hover:bg-semper-gold hover:bg-opacity-30 border-b border-github-border last:border-b-0"
                                      disabled={assigningInstaAdmin}
                                    >
                                      <div className="font-medium">{inst.name}</div>
                                      <div className="text-xs text-gray-400">{inst.acronym || inst.id} - {inst.location || 'No location'}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-2 text-gray-400">No matching installations found</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sponsorship Coordinator (View Only) */}
                      <div className="mb-6 p-4 bg-github-gray bg-opacity-10 border border-github-border rounded-lg">
                        <h4 className="text-white font-medium mb-3">Sponsorship Coordinator Permission</h4>
                        {coordinatorRucs.length > 0 ? (
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

                      {/* Close Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setEditingUserEdipi(null)
                            setUnitSearchQuery('')
                            setInstallationSearchQuery('')
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : tab === 'installations' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <input
                  className="flex-1 px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                  placeholder="Search by name, acronym, location, or command"
                  value={installationQuery}
                  onChange={e => setInstallationQuery(e.target.value)}
                />
                <button
                  onClick={() => setCreatingInstallation(true)}
                  className="ml-4 px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                >
                  + New Installation
                </button>
              </div>
              <div className="text-gray-400 text-sm mb-2">{filteredInstallations.length} installations</div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Acronym</th>
                      <th className="text-left p-2">Location</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Command</th>
                      <th className="text-left p-2">Units</th>
                      <th className="text-left p-2">Admins</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInstallations.map(inst => (
                      <tr key={inst.id} className="border-t border-github-border text-gray-300 hover:bg-[#AD1B3F] transition-colors">
                        <td className="p-2">
                          {editingInstallationId === inst.id ? (
                            <input
                              value={editInstallationName}
                              onChange={(e) => setEditInstallationName(e.target.value)}
                              className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm"
                            />
                          ) : (
                            inst.name
                          )}
                        </td>
                        <td className="p-2">
                          {editingInstallationId === inst.id ? (
                            <input
                              value={editInstallationAcronym}
                              onChange={(e) => setEditInstallationAcronym(e.target.value)}
                              className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm"
                            />
                          ) : (
                            inst.acronym || '-'
                          )}
                        </td>
                        <td className="p-2">
                          {editingInstallationId === inst.id ? (
                            <input
                              value={editInstallationLocation}
                              onChange={(e) => setEditInstallationLocation(e.target.value)}
                              className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm"
                            />
                          ) : (
                            inst.location || '-'
                          )}
                        </td>
                        <td className="p-2">
                          {editingInstallationId === inst.id ? (
                            <input
                              value={editInstallationBaseType}
                              onChange={(e) => setEditInstallationBaseType(e.target.value)}
                              className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm"
                            />
                          ) : (
                            inst.base_type || '-'
                          )}
                        </td>
                        <td className="p-2">
                          {editingInstallationId === inst.id ? (
                            <input
                              value={editInstallationCommand}
                              onChange={(e) => setEditInstallationCommand(e.target.value)}
                              className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm"
                            />
                          ) : (
                            inst.command || '-'
                          )}
                        </td>
                        <td className="p-2">{inst.unit_ids?.length || 0}</td>
                        <td className="p-2">
                          {addingInstaAdmin === inst.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={newInstaAdminEdipi}
                                onChange={(e) => setNewInstaAdminEdipi(e.target.value)}
                                placeholder="EDIPI"
                                className="w-24 px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs"
                              />
                              <button
                                onClick={() => handleAddInstaAdmin(inst.id, newInstaAdminEdipi)}
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setAddingInstaAdmin(null); setNewInstaAdminEdipi('') }}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(inst.insta_admin_user_ids || []).map(edipi => {
                                const profile = adminProfiles[edipi]
                                const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : ''
                                return (
                                  <span key={edipi} className="inline-flex items-center gap-1 px-2 py-0.5 bg-github-gray bg-opacity-20 border border-github-border rounded text-xs">
                                    {name || edipi}
                                    <button
                                      onClick={() => handleRemoveInstaAdmin(inst.id, edipi)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      ×
                                    </button>
                                  </span>
                                )
                              })}
                              <button
                                onClick={() => setAddingInstaAdmin(inst.id)}
                                className="px-2 py-0.5 bg-github-blue bg-opacity-20 border border-github-blue rounded text-xs text-github-blue hover:bg-opacity-40"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {editingInstallationId === inst.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleUpdateInstallation(inst.id)}
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingInstallationId(null)}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingInstallationId(inst.id)
                                  setEditInstallationName(inst.name)
                                  setEditInstallationAcronym(inst.acronym || '')
                                  setEditInstallationLocation(inst.location || '')
                                  setEditInstallationBaseType(inst.base_type || '')
                                  setEditInstallationCommand(inst.command || '')
                                }}
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteInstallation(inst.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={installationsPage}
                totalPages={totalInstallationsPages}
                pageSize={installationsPageSize}
                totalItems={filteredInstallations.length}
                onPageChange={setInstallationsPage}
                onPageSizeChange={setInstallationsPageSize}
              />

              {/* Create Installation Modal */}
              {creatingInstallation && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                  <div className="bg-github-dark border border-github-border rounded-xl p-6 max-w-lg w-full mx-4">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-semibold text-white">Create Installation</h3>
                      <button
                        onClick={() => {
                          setCreatingInstallation(false)
                          setNewInstallationName('')
                          setNewInstallationAcronym('')
                          setNewInstallationLocation('')
                          setNewInstallationBaseType('')
                          setNewInstallationCommand('')
                        }}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Name *</label>
                        <input
                          value={newInstallationName}
                          onChange={(e) => setNewInstallationName(e.target.value)}
                          placeholder="e.g., Marine Corps Base Camp Lejeune"
                          className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Acronym</label>
                        <input
                          value={newInstallationAcronym}
                          onChange={(e) => setNewInstallationAcronym(e.target.value)}
                          placeholder="e.g., CLNC"
                          className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Location</label>
                        <input
                          value={newInstallationLocation}
                          onChange={(e) => setNewInstallationLocation(e.target.value)}
                          placeholder="e.g., Jacksonville, NC"
                          className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Base Type</label>
                        <input
                          value={newInstallationBaseType}
                          onChange={(e) => setNewInstallationBaseType(e.target.value)}
                          placeholder="e.g., Base, Air Station, Training"
                          className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Command</label>
                        <input
                          value={newInstallationCommand}
                          onChange={(e) => setNewInstallationCommand(e.target.value)}
                          placeholder="e.g., MCIEAST, MCIWEST"
                          className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                      <button
                        onClick={handleCreateInstallation}
                        disabled={!newInstallationName.trim()}
                        className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setCreatingInstallation(false)
                          setNewInstallationName('')
                          setNewInstallationAcronym('')
                          setNewInstallationLocation('')
                          setNewInstallationBaseType('')
                          setNewInstallationCommand('')
                        }}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
