import { Shield, ListChecks, Settings as Gear, LogOut, ChevronDown, UserCheck, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, useState } from 'react'
import { getRoleOverride } from '@/utils/localUsersStore'
import { normalizeOrgRole } from '@/utils/roles'
import { sbListUnitAdmins } from '@/services/adminService'
import { listSections } from '@/utils/unitStructure'

export default function HeaderTools() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [sectionLabel, setSectionLabel] = useState('')
  const [isAssignedUnitAdmin, setIsAssignedUnitAdmin] = useState(false)

  // Get effective role: override takes precedence over stored user role
  const roleOverride = getRoleOverride(user?.edipi || '')
  const effectiveRole = normalizeOrgRole(roleOverride?.org_role) || normalizeOrgRole(user?.org_role)

  useEffect(() => {
    const load = async () => {
      const uid = user?.unit_id
      const secId = user?.platoon_id
      if (!uid || !secId) { setSectionLabel(''); return }
      const secs = await listSections(uid)
      const byId = secs.find(s => String(s.id) === String(secId))
      if (byId) {
        setSectionLabel((byId as any).display_name || byId.section_name)
        return
      }
      const byCode = secs.find(s => s.section_name === secId)
      setSectionLabel((byCode as any)?.display_name || byCode?.section_name || '')
    }
    load()
  }, [user?.unit_id, user?.platoon_id])

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const admins = await sbListUnitAdmins()
        const ok = !!admins.find(a => a.admin_user_id === (user?.edipi || ''))
        setIsAssignedUnitAdmin(ok)
      } catch {
        setIsAssignedUnitAdmin(false)
      }
    }
    if (user?.edipi) loadAdmins()
  }, [user?.edipi])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="flex items-center space-x-2 sm:space-x-4">
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="flex items-center px-2 sm:px-3 py-2 text-gray-300 hover:text-white transition-colors text-sm sm:text-base">
          <span className="hidden sm:inline">Dashboards</span>
          <span className="sm:hidden">Menu</span>
          <ChevronDown className="w-4 h-4 ml-1 sm:ml-2" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-black border border-github-border rounded-lg shadow-lg z-50">
            <div className="py-2">
              <button onMouseDown={() => { setOpen(false); navigate('/my-dashboard') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                <UserCheck className="w-5 h-5 mr-2" />
                My Dashboard
              </button>
              {(user?.edipi === '1402008233' || normalizeOrgRole(user?.org_role) === 'App_Admin') && (
                <button onMouseDown={() => { setOpen(false); navigate('/admin') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                  <Shield className="w-5 h-5 mr-2" />
                  App Admin
                </button>
              )}
              {(effectiveRole === 'Unit_Admin' || isAssignedUnitAdmin) && (
                <button onMouseDown={() => { setOpen(false); navigate('/unit-admin') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                  <Shield className="w-5 h-5 mr-2" />
                  Unit Admin
                </button>
              )}
              {effectiveRole === 'Company_Manager' && (
                <button onMouseDown={() => { setOpen(false); navigate('/company-manager') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                  <Building2 className="w-5 h-5 mr-2" />
                  Company Manager
                </button>
              )}
              {effectiveRole === 'Section_Manager' && (
                <button onMouseDown={() => { setOpen(false); navigate('/section-manager') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                  <ListChecks className="w-5 h-5 mr-2" />
                  Section Manager
                </button>
              )}
              {effectiveRole === 'Section_Manager' && (
                <button onMouseDown={() => { setOpen(false); navigate('/task-manager') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                  <ListChecks className="w-5 h-5 mr-2" />
                  Task Manager
                </button>
              )}
              <button onMouseDown={() => { setOpen(false); navigate('/settings') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                <Gear className="w-5 h-5 mr-2" />
                Settings
              </button>
              <button onMouseDown={() => { setOpen(false); logout(); navigate('/') }} className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-700 text-white">
                <LogOut className="w-5 h-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="text-xs sm:text-sm text-gray-300 truncate max-w-[100px] sm:max-w-none">
        <span className="hidden sm:inline">
          {[
            user?.rank,
            [user?.first_name, user?.last_name].filter(Boolean).join(' ')
          ]
            .filter(Boolean)
            .join(' ')}
          {sectionLabel ? ` | ${sectionLabel}` : ''}
        </span>
        <span className="sm:hidden">
          {user?.rank} {user?.last_name}
        </span>
      </span>
      
    </div>
  )
}
