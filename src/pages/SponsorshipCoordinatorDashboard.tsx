import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import { LocalUserProfile } from '@/services/localDataService'
import { sbListUsers } from '@/services/supabaseDataService'
import {
  sbGetCoordinatorRucs,
  sbListOutboundSubmissionsByDestinationRuc,
  sbAssignSponsor,
  sbRemoveSponsorAssignment
} from '@/services/adminService'
import { UNITS } from '@/utils/units'
import { MyFormSubmission } from '@/utils/myFormSubmissionsStore'

// Helper to extract RUC from unit_id (format: UIC-RUC-MCC)
const extractRucFromUnitId = (unitId: string): string => {
  if (!unitId) return ''
  const parts = unitId.split('-')
  return parts.length >= 2 ? parts[1] : unitId
}

export default function SponsorshipCoordinatorDashboard() {
  const { user } = useAuthStore()
  const [coordinatorRucs, setCoordinatorRucs] = useState<string[]>([])
  const [selectedRuc, setSelectedRuc] = useState<string>('')
  const [incomingMembers, setIncomingMembers] = useState<MyFormSubmission[]>([])
  const [memberMap, setMemberMap] = useState<Record<string, LocalUserProfile>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assigningSubmission, setAssigningSubmission] = useState<MyFormSubmission | null>(null)
  const [sponsorSearch, setSponsorSearch] = useState('')
  const [availableSponsors, setAvailableSponsors] = useState<LocalUserProfile[]>([])

  // Get unit name from unit_id
  const getUnitName = (unitId: string) => {
    if (!unitId) return ''
    const ruc = extractRucFromUnitId(unitId)
    const unit = UNITS.find(u => u.ruc === ruc || `${u.uic}-${u.ruc}-${u.mcc}` === unitId)
    return unit?.unitName || unitId
  }

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        // Load all users for member map
        const allUsers = await sbListUsers()
        const map: Record<string, LocalUserProfile> = {}
        for (const profile of allUsers) {
          map[profile.user_id] = profile
          map[profile.edipi] = profile
        }
        setMemberMap(map)

        // Get RUCs this user coordinates
        const rucs = await sbGetCoordinatorRucs(user.edipi)
        setCoordinatorRucs(rucs)

        if (rucs.length > 0) {
          const initialRuc = rucs[0]
          setSelectedRuc(initialRuc)
          await loadIncomingMembers(initialRuc)
        }

        // Set available sponsors from users in the RUC
        setAvailableSponsors(allUsers.filter(u => {
          const userRuc = extractRucFromUnitId(u.unit_id || '')
          return rucs.includes(userRuc)
        }))
        setError(null)
      } catch (err) {
        console.error('Error loading coordinator dashboard:', err)
        setError('Failed to load dashboard data. Please try refreshing the page.')
      }
      setLoading(false)
    }
    load()
  }, [user])

  const loadIncomingMembers = async (ruc: string) => {
    try {
      const submissions = await sbListOutboundSubmissionsByDestinationRuc(ruc)
      setIncomingMembers(submissions)
      setError(null)
    } catch (err) {
      console.error('Error loading incoming members:', err)
      setError('Failed to load incoming members.')
    }
  }

  const handleRucChange = async (ruc: string) => {
    setSelectedRuc(ruc)
    setExpandedRow(null)
    await loadIncomingMembers(ruc)
  }

  const handleAssignSponsor = async (sponsor: LocalUserProfile) => {
    if (!assigningSubmission) return
    try {
      const sponsorName = [sponsor.rank, sponsor.first_name, sponsor.last_name].filter(Boolean).join(' ')
      await sbAssignSponsor(assigningSubmission.id, sponsor.edipi, sponsorName)
      // Refresh the list
      await loadIncomingMembers(selectedRuc)
      setAssignModalOpen(false)
      setAssigningSubmission(null)
      setSponsorSearch('')
    } catch (err) {
      console.error('Error assigning sponsor:', err)
      alert('Failed to assign sponsor. Please try again.')
    }
  }

  const handleRemoveSponsor = async (submission: MyFormSubmission) => {
    try {
      await sbRemoveSponsorAssignment(submission.id)
      await loadIncomingMembers(selectedRuc)
    } catch (err) {
      console.error('Error removing sponsor:', err)
      alert('Failed to remove sponsor. Please try again.')
    }
  }

  const filteredSponsors = availableSponsors.filter(s => {
    if (!sponsorSearch) return true
    const name = [s.rank, s.first_name, s.last_name].filter(Boolean).join(' ').toLowerCase()
    return name.includes(sponsorSearch.toLowerCase()) || s.edipi.includes(sponsorSearch)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-github-blue mb-4"></div>
          <p className="text-gray-400">Loading Sponsorship Coordinator Dashboard...</p>
        </div>
      </div>
    )
  }

  if (coordinatorRucs.length === 0) {
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
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <p>You are not assigned as a Sponsorship Coordinator for any RUC.</p>
            <p className="mt-2 text-sm">Contact your Unit Admin to be assigned.</p>
          </div>
        </main>
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
          <div className="flex flex-wrap items-center justify-between border-b border-github-border px-4 py-3 gap-3">
            <h1 className="text-white text-lg font-medium">Sponsorship Coordinator Dashboard</h1>
            {coordinatorRucs.length > 1 && (
              <select
                value={selectedRuc}
                onChange={e => handleRucChange(e.target.value)}
                className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-sm"
              >
                {coordinatorRucs.map(ruc => (
                  <option key={ruc} value={ruc}>RUC: {ruc}</option>
                ))}
              </select>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-600 rounded text-red-400 text-sm">
                {error}
              </div>
            )}
            <div className="mb-4">
              <p className="text-gray-400 text-sm">
                Incoming Marines to RUC {selectedRuc}: <span className="text-white font-medium">{incomingMembers.length}</span>
              </p>
            </div>

            {incomingMembers.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>No incoming marines with outbound forms for this RUC.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="text-left p-2">Rank/Name</th>
                      <th className="text-left p-2">EDIPI</th>
                      <th className="text-left p-2 hidden sm:table-cell">Current Unit</th>
                      <th className="text-left p-2">Departure Date</th>
                      <th className="text-left p-2 hidden md:table-cell">Sponsor</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomingMembers.map((submission) => {
                      const member = submission.member
                      const memberName = [member?.rank, member?.first_name, member?.last_name].filter(Boolean).join(' ')
                      // Look up actual member unit from their profile, not the submission snapshot
                      const memberProfile = memberMap[submission.user_id] || memberMap[member?.edipi || '']
                      const currentUnit = memberProfile?.unit_id || submission.unit_id || ''
                      const isExpanded = expandedRow === submission.id

                      return (
                        <>
                          <tr
                            key={submission.id}
                            className={`border-t border-github-border text-gray-300 hover:bg-red-900 hover:bg-opacity-30 cursor-pointer transition-colors ${isExpanded ? 'bg-red-900 bg-opacity-20' : ''}`}
                            onClick={() => setExpandedRow(isExpanded ? null : submission.id)}
                          >
                            <td className="p-2">
                              <div>{memberName || 'Unknown'}</div>
                              <div className="text-xs text-gray-500 sm:hidden">{getUnitName(currentUnit)}</div>
                            </td>
                            <td className="p-2">{member?.edipi || ''}</td>
                            <td className="p-2 hidden sm:table-cell">{getUnitName(currentUnit)}</td>
                            <td className="p-2">{submission.departure_date || 'N/A'}</td>
                            <td className="p-2 hidden md:table-cell">
                              {submission.assigned_sponsor_name ? (
                                <span className="text-green-400">{submission.assigned_sponsor_name}</span>
                              ) : (
                                <span className="text-yellow-400">Not Assigned</span>
                              )}
                            </td>
                            <td className="p-2">
                              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    setAssigningSubmission(submission)
                                    setAssignModalOpen(true)
                                  }}
                                  className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                >
                                  {submission.assigned_sponsor_edipi ? 'Change' : 'Assign'}
                                </button>
                                {submission.assigned_sponsor_edipi && (
                                  <button
                                    onClick={() => handleRemoveSponsor(submission)}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${submission.id}-details`} className="bg-github-gray bg-opacity-5">
                              <td colSpan={6} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <h4 className="text-gray-400 text-xs uppercase mb-2">Personal Information</h4>
                                    <div className="space-y-1">
                                      <div><span className="text-gray-500">Full Name:</span> <span className="text-white">{memberName}</span></div>
                                      <div><span className="text-gray-500">Rank:</span> <span className="text-white">{member?.rank || 'N/A'}</span></div>
                                      <div><span className="text-gray-500">EDIPI:</span> <span className="text-white">{member?.edipi || 'N/A'}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-gray-400 text-xs uppercase mb-2">Contact Information</h4>
                                    <div className="space-y-1">
                                      <div><span className="text-gray-500">Email:</span> <span className="text-white">{member?.email || memberMap[member?.edipi || '']?.email || 'N/A'}</span></div>
                                      <div><span className="text-gray-500">Phone:</span> <span className="text-white">{member?.phone_number || memberMap[member?.edipi || '']?.phone_number || 'N/A'}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-gray-400 text-xs uppercase mb-2">Transfer Details</h4>
                                    <div className="space-y-1">
                                      <div><span className="text-gray-500">Current Unit:</span> <span className="text-white">{getUnitName(currentUnit)}</span></div>
                                      <div><span className="text-gray-500">Destination:</span> <span className="text-white">{getUnitName(submission.destination_unit_id || '')}</span></div>
                                      <div><span className="text-gray-500">Departure Date:</span> <span className="text-white">{submission.departure_date || 'N/A'}</span></div>
                                      <div><span className="text-gray-500">Form:</span> <span className="text-white">{submission.form_name}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-gray-400 text-xs uppercase mb-2">Current Assignment</h4>
                                    <div className="space-y-1">
                                      <div><span className="text-gray-500">Company:</span> <span className="text-white">{member?.company_id || 'N/A'}</span></div>
                                      <div><span className="text-gray-500">Section:</span> <span className="text-white">{member?.platoon_id || 'N/A'}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-gray-400 text-xs uppercase mb-2">Sponsor Assignment</h4>
                                    <div className="space-y-1">
                                      {submission.assigned_sponsor_name ? (
                                        <>
                                          <div><span className="text-gray-500">Sponsor:</span> <span className="text-green-400">{submission.assigned_sponsor_name}</span></div>
                                          <div><span className="text-gray-500">Sponsor EDIPI:</span> <span className="text-white">{submission.assigned_sponsor_edipi}</span></div>
                                          {memberMap[submission.assigned_sponsor_edipi || ''] && (
                                            <>
                                              <div><span className="text-gray-500">Sponsor Email:</span> <span className="text-white">{memberMap[submission.assigned_sponsor_edipi || '']?.email || 'N/A'}</span></div>
                                              <div><span className="text-gray-500">Sponsor Phone:</span> <span className="text-white">{memberMap[submission.assigned_sponsor_edipi || '']?.phone_number || 'N/A'}</span></div>
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        <div className="text-yellow-400">No sponsor assigned</div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-gray-400 text-xs uppercase mb-2">Form Progress</h4>
                                    <div className="space-y-1">
                                      <div><span className="text-gray-500">Status:</span> <span className={submission.status === 'Completed' ? 'text-green-400' : 'text-yellow-400'}>{submission.status || 'In Progress'}</span></div>
                                      <div><span className="text-gray-500">Progress:</span> <span className="text-white">{submission.completed_count || 0}/{submission.total_count || 0} tasks</span></div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Assign Sponsor Modal */}
      {assignModalOpen && assigningSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-white text-lg mb-4">
              Assign Sponsor for {[assigningSubmission.member?.rank, assigningSubmission.member?.first_name, assigningSubmission.member?.last_name].filter(Boolean).join(' ')}
            </h3>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name or EDIPI..."
                value={sponsorSearch}
                onChange={e => setSponsorSearch(e.target.value)}
                className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
              />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredSponsors.length === 0 ? (
                <p className="text-gray-400 text-sm">No sponsors found</p>
              ) : (
                filteredSponsors.slice(0, 20).map(sponsor => (
                  <button
                    key={sponsor.edipi}
                    onClick={() => handleAssignSponsor(sponsor)}
                    className="w-full text-left px-3 py-2 bg-github-gray bg-opacity-20 hover:bg-opacity-40 border border-github-border rounded text-white"
                  >
                    <div className="flex justify-between items-center">
                      <span>{[sponsor.rank, sponsor.first_name, sponsor.last_name].filter(Boolean).join(' ')}</span>
                      <span className="text-gray-500 text-xs">{sponsor.edipi}</span>
                    </div>
                    {sponsor.email && <div className="text-xs text-gray-400">{sponsor.email}</div>}
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setAssignModalOpen(false)
                  setAssigningSubmission(null)
                  setSponsorSearch('')
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
