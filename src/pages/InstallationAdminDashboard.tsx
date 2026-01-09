import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  listInstallations,
  getInstallation,
  updateInstallation,
  listInstallationSections,
  createInstallationSection,
  updateInstallationSection,
  deleteInstallationSection,
  listInstallationSubTasks,
  createInstallationSubTask,
  updateInstallationSubTask,
  deleteInstallationSubTask,
  addInstaAdmin,
  removeInstaAdmin,
} from '@/services/supabaseInstallationService'
import { sbListUsersByRuc } from '@/services/supabaseDataService'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import type { Installation, InstallationSection, InstallationSubTask } from '@/types'
import { LocalUserProfile } from '@/services/localDataService'
import { UNITS } from '@/utils/units'

export default function InstallationAdminDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'info' | 'sections' | 'tasks' | 'units' | 'members'>('sections')
  const [installations, setInstallations] = useState<Installation[]>([])
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>('')
  const [installation, setInstallation] = useState<Installation | null>(null)
  const [sections, setSections] = useState<InstallationSection[]>([])
  const [tasks, setTasks] = useState<InstallationSubTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Section form state
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionDisplay, setNewSectionDisplay] = useState('')
  const [newSectionLocation, setNewSectionLocation] = useState('')
  const [newSectionPhone, setNewSectionPhone] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [editSectionName, setEditSectionName] = useState('')
  const [editSectionDisplay, setEditSectionDisplay] = useState('')
  const [editSectionLocation, setEditSectionLocation] = useState('')
  const [editSectionPhone, setEditSectionPhone] = useState('')

  // Task form state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)
  const [newTaskSectionId, setNewTaskSectionId] = useState<number>(0)
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskLocation, setNewTaskLocation] = useState('')
  const [newTaskMapUrl, setNewTaskMapUrl] = useState('')
  const [newTaskInstructions, setNewTaskInstructions] = useState('')
  const [newTaskFormType, setNewTaskFormType] = useState<'Inbound' | 'Outbound' | ''>('')
  const [newTaskPurpose, setNewTaskPurpose] = useState<'Fleet_Assistance_Program' | 'TAD_31_plus_days' | 'TAD_30_or_less' | 'PCA' | 'PCS' | 'Separation' | 'Retirement' | ''>('')
  const [newTaskCompletionKind, setNewTaskCompletionKind] = useState<'Text' | 'Date' | 'Options' | 'Link' | ''>('')
  const [newTaskCompletionLabel, setNewTaskCompletionLabel] = useState('')
  const [newTaskCompletionOptions, setNewTaskCompletionOptions] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTaskDescription, setEditTaskDescription] = useState('')
  const [editTaskLocation, setEditTaskLocation] = useState('')
  const [editTaskMapUrl, setEditTaskMapUrl] = useState('')
  const [editTaskInstructions, setEditTaskInstructions] = useState('')

  // Units state
  const [availableUnits, setAvailableUnits] = useState<Array<{ id: string; name: string; uic?: string; ruc?: string }>>([])
  const [unitsTab, setUnitsTab] = useState<'assigned' | 'unassigned'>('assigned')
  const [unitSearchQuery, setUnitSearchQuery] = useState('')

  // Members state
  const [members, setMembers] = useState<LocalUserProfile[]>([])
  const [addAdminModalOpen, setAddAdminModalOpen] = useState(false)
  const [selectedAdminEdipi, setSelectedAdminEdipi] = useState('')

  // Installation info editing
  const [editingInfo, setEditingInfo] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAcronym, setEditAcronym] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editBaseType, setEditBaseType] = useState('')
  const [editCommand, setEditCommand] = useState('')

  // Load installations on mount
  useEffect(() => {
    const load = async () => {
      try {
        const list = await listInstallations()
        setInstallations(list)

        // Find installation where user is an admin
        const userInstallation = list.find(i =>
          i.insta_admin_user_ids?.includes(user?.edipi || '') ||
          i.insta_admin_user_ids?.includes(user?.user_id || '')
        )

        if (userInstallation) {
          setSelectedInstallationId(userInstallation.id)
        } else if (list.length > 0) {
          // For App Admins, default to first installation
          setSelectedInstallationId(list[0].id)
        }
      } catch (err) {
        console.error('Failed to load installations:', err)
        setError('Failed to load installations')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Load installation data when selected
  useEffect(() => {
    if (!selectedInstallationId) return

    const loadInstallation = async () => {
      try {
        const inst = await getInstallation(selectedInstallationId)
        setInstallation(inst)

        if (inst) {
          const secs = await listInstallationSections(inst.id)
          setSections(secs)

          const tsks = await listInstallationSubTasks(inst.id)
          setTasks(tsks)

          // Load available units
          const allUnits = UNITS.map(u => ({
            id: `${u.uic}-${u.ruc}-${u.mcc}`,
            name: u.unitName,
            uic: u.uic,
            ruc: String(u.ruc),
          }))
          setAvailableUnits(allUnits)
        }
      } catch (err) {
        console.error('Failed to load installation data:', err)
      }
    }
    loadInstallation()
  }, [selectedInstallationId])

  // Load members (civilians at installation)
  useEffect(() => {
    if (!installation) return

    const loadMembers = async () => {
      try {
        // Get users who are insta admins or assigned to this installation
        const adminEdipis = installation.insta_admin_user_ids || []
        const allMembers: LocalUserProfile[] = []

        // For each assigned unit, get members
        for (const unitId of (installation.unit_ids || [])) {
          try {
            const ruc = unitId.includes('-') ? unitId.split('-')[1] : unitId
            const unitMembers = await sbListUsersByRuc(ruc)
            allMembers.push(...unitMembers)
          } catch {}
        }

        // Deduplicate
        const unique = Array.from(new Map(allMembers.map(m => [m.edipi, m])).values())
        setMembers(unique)
      } catch (err) {
        console.error('Failed to load members:', err)
      }
    }
    loadMembers()
  }, [installation])

  // Check access
  const isAppAdmin = user?.is_app_admin || user?.org_role === 'App_Admin'
  const isInstaAdmin = installation?.insta_admin_user_ids?.includes(user?.edipi || '') ||
                       installation?.insta_admin_user_ids?.includes(user?.user_id || '')

  // Filter installations to only those the user can admin
  const userInstallations = isAppAdmin
    ? installations
    : installations.filter(i =>
        i.insta_admin_user_ids?.includes(user?.edipi || '') ||
        i.insta_admin_user_ids?.includes(user?.user_id || '')
      )

  // Filter units based on search query
  const filteredUnits = availableUnits.filter(u => {
    if (!unitSearchQuery.trim()) return true
    const q = unitSearchQuery.toLowerCase()
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.uic || '').toLowerCase().includes(q) ||
      (u.ruc || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    )
  })

  if (!user) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Access denied</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!isAppAdmin && !isInstaAdmin) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <p className="text-gray-400">Access denied - not assigned as Installation Admin</p>
      </div>
    )
  }

  const handleCreateSection = async () => {
    if (!installation || !newSectionName.trim()) return
    setError('')
    try {
      await createInstallationSection(installation.id, newSectionName.trim(), {
        display_name: newSectionDisplay.trim() || undefined,
        physical_location: newSectionLocation.trim() || undefined,
        phone_number: newSectionPhone.trim() || undefined,
      })
      setSections(await listInstallationSections(installation.id))
      setNewSectionName('')
      setNewSectionDisplay('')
      setNewSectionLocation('')
      setNewSectionPhone('')
    } catch (err: any) {
      setError(err?.message || 'Failed to create section')
    }
  }

  const handleUpdateSection = async (id: number) => {
    if (!installation) return
    try {
      await updateInstallationSection(id, {
        section_name: editSectionName,
        display_name: editSectionDisplay || undefined,
        physical_location: editSectionLocation || undefined,
        phone_number: editSectionPhone || undefined,
      })
      setSections(await listInstallationSections(installation.id))
      setEditingSectionId(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to update section')
    }
  }

  const handleDeleteSection = async (id: number) => {
    if (!installation) return
    try {
      await deleteInstallationSection(id)
      setSections(await listInstallationSections(installation.id))
    } catch (err: any) {
      setError(err?.message || 'Failed to delete section')
    }
  }

  const handleCreateTask = async () => {
    if (!installation || !newTaskSectionId || !newTaskDescription.trim()) return
    setError('')
    try {
      await createInstallationSubTask({
        installation_id: installation.id,
        section_id: newTaskSectionId,
        sub_task_id: newTaskDescription.trim(),
        description: newTaskDescription.trim(),
        responsible_user_ids: [],
        location: newTaskLocation.trim() || undefined,
        map_url: newTaskMapUrl.trim() || undefined,
        instructions: newTaskInstructions.trim() || undefined,
        form_type: newTaskFormType || undefined,
        purpose: newTaskPurpose || undefined,
        completion_kind: newTaskCompletionKind || undefined,
        completion_label: newTaskCompletionLabel.trim() || undefined,
        completion_options: newTaskCompletionKind === 'Options'
          ? newTaskCompletionOptions.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
      })
      setTasks(await listInstallationSubTasks(installation.id))
      setCreateTaskModalOpen(false)
      setNewTaskSectionId(0)
      setNewTaskDescription('')
      setNewTaskLocation('')
      setNewTaskMapUrl('')
      setNewTaskInstructions('')
      setNewTaskFormType('')
      setNewTaskPurpose('')
      setNewTaskCompletionKind('')
      setNewTaskCompletionLabel('')
      setNewTaskCompletionOptions('')
    } catch (err: any) {
      setError(err?.message || 'Failed to create task')
    }
  }

  const handleDeleteTask = async (id: number) => {
    if (!installation) return
    try {
      await deleteInstallationSubTask(id)
      setTasks(await listInstallationSubTasks(installation.id))
    } catch (err: any) {
      setError(err?.message || 'Failed to delete task')
    }
  }

  const handleAssignUnit = async (unitId: string) => {
    if (!installation) return
    try {
      const newUnitIds = [...(installation.unit_ids || []), unitId]
      await updateInstallation(installation.id, { unit_ids: newUnitIds })
      setInstallation({ ...installation, unit_ids: newUnitIds })
    } catch (err: any) {
      setError(err?.message || 'Failed to assign unit')
    }
  }

  const handleUnassignUnit = async (unitId: string) => {
    if (!installation) return
    try {
      const newUnitIds = (installation.unit_ids || []).filter(id => id !== unitId)
      await updateInstallation(installation.id, { unit_ids: newUnitIds })
      setInstallation({ ...installation, unit_ids: newUnitIds })
    } catch (err: any) {
      setError(err?.message || 'Failed to unassign unit')
    }
  }

  const handleUpdateInfo = async () => {
    if (!installation) return
    try {
      await updateInstallation(installation.id, {
        name: editName,
        acronym: editAcronym || undefined,
        location: editLocation || undefined,
        base_type: editBaseType || undefined,
        command: editCommand || undefined,
      })
      setInstallation({
        ...installation,
        name: editName,
        acronym: editAcronym,
        location: editLocation,
        base_type: editBaseType,
        command: editCommand,
      })
      setEditingInfo(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to update installation')
    }
  }

  const handleAddAdmin = async () => {
    if (!installation || !selectedAdminEdipi) return
    try {
      await addInstaAdmin(installation.id, selectedAdminEdipi)
      const updated = await getInstallation(installation.id)
      setInstallation(updated)
      setAddAdminModalOpen(false)
      setSelectedAdminEdipi('')
    } catch (err: any) {
      setError(err?.message || 'Failed to add admin')
    }
  }

  const handleRemoveAdmin = async (edipi: string) => {
    if (!installation) return
    try {
      await removeInstaAdmin(installation.id, edipi)
      const updated = await getInstallation(installation.id)
      setInstallation(updated)
    } catch (err: any) {
      setError(err?.message || 'Failed to remove admin')
    }
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

      {/* Installation Selector */}
      {userInstallations.length > 0 && (
        <div className="bg-github-gray bg-opacity-5 border-b border-github-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Installation:</label>
              {userInstallations.length === 1 ? (
                <span className="text-white text-sm font-semibold">
                  {userInstallations[0].acronym ? `${userInstallations[0].acronym} - ${userInstallations[0].name}` : userInstallations[0].name}
                </span>
              ) : (
                <select
                  value={selectedInstallationId}
                  onChange={(e) => setSelectedInstallationId(e.target.value)}
                  className="bg-semper-navy bg-opacity-80 border border-gray-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-semper-gold"
                >
                  {userInstallations.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.acronym ? `${inst.acronym} - ${inst.name}` : inst.name}
                    </option>
                  ))}
                </select>
              )}
              {installation?.location && (
                <span className="text-gray-400 text-sm hidden sm:inline">{installation.location}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-github-border scrollbar-hide">
            <button
              onClick={() => setTab('sections')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'sections' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Sections
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'tasks' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Tasks
            </button>
            <button
              onClick={() => setTab('units')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'units' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Units
            </button>
            <button
              onClick={() => setTab('members')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'members' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Admins
            </button>
            <button
              onClick={() => setTab('info')}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${tab === 'info' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
            >
              Info
            </button>
          </div>

          <div className="p-3 sm:p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-600 rounded text-red-400 text-sm">
                {error}
                <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-white">Dismiss</button>
              </div>
            )}

            {/* Info Tab */}
            {tab === 'info' && installation && (
              <div className="space-y-6">
                {editingInfo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Acronym</label>
                      <input
                        value={editAcronym}
                        onChange={(e) => setEditAcronym(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Location</label>
                      <input
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Base Type</label>
                      <input
                        value={editBaseType}
                        onChange={(e) => setEditBaseType(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Command</label>
                      <input
                        value={editCommand}
                        onChange={(e) => setEditCommand(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                      />
                    </div>
                    <div className="sm:col-span-2 flex gap-2">
                      <button onClick={handleUpdateInfo} className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded">Save</button>
                      <button onClick={() => setEditingInfo(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400 text-sm">Name</span>
                        <div className="text-white">{installation.name}</div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Acronym</span>
                        <div className="text-white">{installation.acronym || '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Location</span>
                        <div className="text-white">{installation.location || '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Base Type</span>
                        <div className="text-white">{installation.base_type || '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Command</span>
                        <div className="text-white">{installation.command || '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Assigned Units</span>
                        <div className="text-white">{installation.unit_ids?.length || 0}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditName(installation.name)
                        setEditAcronym(installation.acronym || '')
                        setEditLocation(installation.location || '')
                        setEditBaseType(installation.base_type || '')
                        setEditCommand(installation.command || '')
                        setEditingInfo(true)
                      }}
                      className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sections Tab */}
            {tab === 'sections' && (
              <div className="space-y-4">
                <div className="text-gray-300 text-sm mb-4">
                  Installation sections are inherited by all assigned units. Unit Admins cannot remove these sections.
                </div>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left p-2">Code</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2 hidden sm:table-cell">Location</th>
                        <th className="text-left p-2 hidden sm:table-cell">Phone</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* New section row */}
                      <tr className="border-t border-github-border">
                        <td className="p-2">
                          <input
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            placeholder="Code"
                            className="w-full min-w-[80px] px-2 py-2 bg-black bg-opacity-40 border border-github-border rounded text-white placeholder-gray-400 text-xs sm:text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={newSectionDisplay}
                            onChange={(e) => setNewSectionDisplay(e.target.value)}
                            placeholder="Display Name"
                            className="w-full min-w-[80px] px-2 py-2 bg-black bg-opacity-40 border border-github-border rounded text-white placeholder-gray-400 text-xs sm:text-sm"
                          />
                        </td>
                        <td className="p-2 hidden sm:table-cell">
                          <input
                            value={newSectionLocation}
                            onChange={(e) => setNewSectionLocation(e.target.value)}
                            placeholder="Location"
                            className="w-full px-2 py-2 bg-black bg-opacity-40 border border-github-border rounded text-white placeholder-gray-400 text-xs sm:text-sm"
                          />
                        </td>
                        <td className="p-2 hidden sm:table-cell">
                          <input
                            value={newSectionPhone}
                            onChange={(e) => setNewSectionPhone(e.target.value)}
                            placeholder="Phone"
                            className="w-full px-2 py-2 bg-black bg-opacity-40 border border-github-border rounded text-white placeholder-gray-400 text-xs sm:text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <button
                            onClick={handleCreateSection}
                            disabled={!newSectionName.trim()}
                            className="px-3 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-xs sm:text-sm disabled:opacity-50"
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                      {sections.map((s) => (
                        <tr key={s.id} className="border-t border-github-border text-gray-300">
                          <td className="p-2">
                            {editingSectionId === s.id ? (
                              <input
                                value={editSectionName}
                                onChange={(e) => setEditSectionName(e.target.value)}
                                className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs"
                              />
                            ) : (
                              s.section_name
                            )}
                          </td>
                          <td className="p-2">
                            {editingSectionId === s.id ? (
                              <input
                                value={editSectionDisplay}
                                onChange={(e) => setEditSectionDisplay(e.target.value)}
                                className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs"
                              />
                            ) : (
                              s.display_name || '-'
                            )}
                          </td>
                          <td className="p-2 hidden sm:table-cell">
                            {editingSectionId === s.id ? (
                              <input
                                value={editSectionLocation}
                                onChange={(e) => setEditSectionLocation(e.target.value)}
                                className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs"
                              />
                            ) : (
                              s.physical_location || '-'
                            )}
                          </td>
                          <td className="p-2 hidden sm:table-cell">
                            {editingSectionId === s.id ? (
                              <input
                                value={editSectionPhone}
                                onChange={(e) => setEditSectionPhone(e.target.value)}
                                className="w-full px-2 py-1 bg-github-gray bg-opacity-20 border border-github-border rounded text-white text-xs"
                              />
                            ) : (
                              s.phone_number || '-'
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              {editingSectionId === s.id ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateSection(s.id)}
                                    className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingSectionId(null)}
                                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                                  >
                                    X
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingSectionId(s.id)
                                      setEditSectionName(s.section_name)
                                      setEditSectionDisplay(s.display_name || '')
                                      setEditSectionLocation(s.physical_location || '')
                                      setEditSectionPhone(s.phone_number || '')
                                    }}
                                    className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSection(s.id)}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                  >
                                    Del
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {tab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-gray-300 text-sm">
                    Installation tasks are inherited by all assigned units and cannot be removed by Unit Admins.
                  </div>
                  <button
                    onClick={() => {
                      setCreateTaskModalOpen(true)
                      if (sections.length > 0) setNewTaskSectionId(sections[0].id)
                    }}
                    className="px-3 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-sm whitespace-nowrap"
                  >
                    + New Task
                  </button>
                </div>

                {/* Task creation modal */}
                {createTaskModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg bg-black border border-github-border rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                      <h3 className="text-white text-lg mb-4">Create Installation Task</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <select
                          value={newTaskSectionId}
                          onChange={(e) => setNewTaskSectionId(Number(e.target.value))}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value={0}>Select section</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.display_name || s.section_name}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Task description"
                          rows={3}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={newTaskLocation}
                            onChange={(e) => setNewTaskLocation(e.target.value)}
                            placeholder="Location"
                            className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                          />
                          <input
                            value={newTaskMapUrl}
                            onChange={(e) => setNewTaskMapUrl(e.target.value)}
                            placeholder="Map URL"
                            className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                          />
                        </div>
                        <textarea
                          value={newTaskInstructions}
                          onChange={(e) => setNewTaskInstructions(e.target.value)}
                          placeholder="Instructions"
                          rows={2}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-gray-400 text-xs mb-1">Form Type</label>
                            <select
                              value={newTaskFormType}
                              onChange={(e) => setNewTaskFormType(e.target.value as any)}
                              className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                            >
                              <option value="">Select form type</option>
                              <option value="Inbound">Inbound</option>
                              <option value="Outbound">Outbound</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-gray-400 text-xs mb-1">Purpose</label>
                            <select
                              value={newTaskPurpose}
                              onChange={(e) => setNewTaskPurpose(e.target.value as any)}
                              className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                            >
                              <option value="">Select purpose</option>
                              <option value="PCS">PCS</option>
                              <option value="PCA">PCA</option>
                              <option value="TAD_31_plus_days">TAD (31+ days)</option>
                              <option value="TAD_30_or_less">TAD (30 or less)</option>
                              <option value="Separation">Separation</option>
                              <option value="Retirement">Retirement</option>
                              <option value="Fleet_Assistance_Program">Fleet Assistance Program</option>
                            </select>
                          </div>
                        </div>
                        <select
                          value={newTaskCompletionKind}
                          onChange={(e) => setNewTaskCompletionKind(e.target.value as any)}
                          className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                        >
                          <option value="">Completion type</option>
                          <option value="Text">Text</option>
                          <option value="Date">Date</option>
                          <option value="Options">Options</option>
                          <option value="Link">Link</option>
                        </select>
                        {newTaskCompletionKind && (
                          <input
                            value={newTaskCompletionLabel}
                            onChange={(e) => setNewTaskCompletionLabel(e.target.value)}
                            placeholder="Completion label"
                            className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                          />
                        )}
                        {newTaskCompletionKind === 'Options' && (
                          <input
                            value={newTaskCompletionOptions}
                            onChange={(e) => setNewTaskCompletionOptions(e.target.value)}
                            placeholder="Options (comma-separated)"
                            className="px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white"
                          />
                        )}
                      </div>
                      <div className="mt-6 flex gap-2 justify-end">
                        <button
                          onClick={handleCreateTask}
                          disabled={!newTaskSectionId || !newTaskDescription.trim()}
                          className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded disabled:opacity-50"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => setCreateTaskModalOpen(false)}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tasks table */}
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left p-2">Section</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2 hidden sm:table-cell">Type</th>
                        <th className="text-left p-2 hidden sm:table-cell">Purpose</th>
                        <th className="text-left p-2 hidden md:table-cell">Location</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => (
                        <tr key={t.id} className="border-t border-github-border text-gray-300">
                          <td className="p-2">
                            {(() => {
                              const sec = sections.find((s) => s.id === t.section_id)
                              return sec?.display_name || sec?.section_name || '-'
                            })()}
                          </td>
                          <td className="p-2">
                            <div>{t.description}</div>
                            {t.instructions && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{t.instructions}</div>
                            )}
                          </td>
                          <td className="p-2 hidden sm:table-cell">
                            {t.form_type ? (
                              <span className={`px-2 py-0.5 rounded text-xs ${t.form_type === 'Inbound' ? 'bg-green-800 text-green-200' : 'bg-blue-800 text-blue-200'}`}>
                                {t.form_type}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-2 hidden sm:table-cell">
                            {t.purpose ? (
                              <span className="text-semper-gold text-xs">
                                {t.purpose.replace(/_/g, ' ')}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-2 hidden md:table-cell">
                            {t.map_url ? (
                              <a href={t.map_url} target="_blank" rel="noopener noreferrer" className="text-semper-gold hover:underline">
                                {t.location || 'Map'}
                              </a>
                            ) : (
                              t.location || '-'
                            )}
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                            >
                              Del
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Units Tab */}
            {tab === 'units' && (
              <div className="space-y-4">
                <div className="text-gray-300 text-sm mb-4">
                  Assign units to this installation. Assigned units will inherit installation sections and tasks.
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <div className="flex overflow-x-auto border-b border-github-border sm:border-b-0">
                    <button
                      onClick={() => setUnitsTab('assigned')}
                      className={`px-3 py-2 text-sm ${unitsTab === 'assigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
                    >
                      Assigned ({installation?.unit_ids?.length || 0})
                    </button>
                    <button
                      onClick={() => setUnitsTab('unassigned')}
                      className={`px-3 py-2 text-sm ${unitsTab === 'unassigned' ? 'text-white border-b-2 border-github-blue' : 'text-gray-400'}`}
                    >
                      Available
                    </button>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={unitSearchQuery}
                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                      placeholder="Search units by name, UIC, or RUC..."
                      className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue text-sm"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left p-2">Unit</th>
                        <th className="text-left p-2">UIC</th>
                        <th className="text-left p-2">RUC</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(unitsTab === 'assigned'
                        ? filteredUnits.filter((u) => installation?.unit_ids?.includes(u.id))
                        : filteredUnits.filter((u) => !installation?.unit_ids?.includes(u.id))
                      ).slice(0, 100).map((u) => (
                        <tr key={u.id} className="border-t border-github-border text-gray-300">
                          <td className="p-2">{u.name}</td>
                          <td className="p-2">{u.uic}</td>
                          <td className="p-2">{u.ruc}</td>
                          <td className="p-2">
                            {unitsTab === 'assigned' ? (
                              <button
                                onClick={() => handleUnassignUnit(u.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAssignUnit(u.id)}
                                className="px-2 py-1 bg-github-blue hover:bg-blue-600 text-white rounded text-xs"
                              >
                                Assign
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUnits.length === 0 && unitSearchQuery && (
                    <div className="text-center py-8 text-gray-400">
                      No units found matching "{unitSearchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Members/Admins Tab */}
            {tab === 'members' && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-gray-300 text-sm">
                    Installation Admins can manage sections, tasks, and unit assignments for this installation.
                  </div>
                  <button
                    onClick={() => setAddAdminModalOpen(true)}
                    className="px-3 py-2 bg-github-blue hover:bg-blue-600 text-white rounded text-sm whitespace-nowrap"
                  >
                    + Add Admin
                  </button>
                </div>

                {/* Add admin modal */}
                {addAdminModalOpen && (
                  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-md bg-black border border-github-border rounded-xl p-4 sm:p-6">
                      <h3 className="text-white text-lg mb-4">Add Installation Admin</h3>
                      <select
                        value={selectedAdminEdipi}
                        onChange={(e) => setSelectedAdminEdipi(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded text-white mb-4"
                      >
                        <option value="">Select member</option>
                        {members
                          .filter((m) => !installation?.insta_admin_user_ids?.includes(m.edipi))
                          .map((m) => (
                            <option key={m.edipi} value={m.edipi}>
                              {[m.rank, m.first_name, m.last_name].filter(Boolean).join(' ')}
                            </option>
                          ))}
                      </select>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleAddAdmin}
                          disabled={!selectedAdminEdipi}
                          className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddAdminModalOpen(false)
                            setSelectedAdminEdipi('')
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admins list */}
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left p-2">Admin</th>
                        <th className="text-left p-2">EDIPI</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(installation?.insta_admin_user_ids || []).map((edipi) => {
                        const member = members.find((m) => m.edipi === edipi)
                        return (
                          <tr key={edipi} className="border-t border-github-border text-gray-300">
                            <td className="p-2">
                              {member
                                ? [member.rank, member.first_name, member.last_name].filter(Boolean).join(' ')
                                : 'Unknown'}
                            </td>
                            <td className="p-2">{edipi}</td>
                            <td className="p-2">
                              <button
                                onClick={() => handleRemoveAdmin(edipi)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                              >
                                Remove
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
        </div>
      </main>
    </div>
  )
}
