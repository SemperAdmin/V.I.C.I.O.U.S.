import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Bell, Palette, Shield, Mail } from 'lucide-react'
import HeaderTools from '@/components/HeaderTools'
import BrandMark from '@/components/BrandMark'
import { listCompanies, listSections } from '@/utils/unitStructure'
import { sbUpdateUser } from '@/services/supabaseDataService'
import { fetchJson, UsersIndexEntry, LocalUserProfile } from '@/services/localDataService'
import '@/js/military-data.js'
 
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { getRoleOverride } from '@/utils/localUsersStore'

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout, login } = useAuthStore()
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [middleInitial, setMiddleInitial] = useState(user?.middle_initial || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '')
  const [branch, setBranch] = useState(user?.branch || '')
  const [rank, setRank] = useState(user?.rank || '')
  const [mos, setMos] = useState(user?.mos || '')
  const [unitId, setUnitId] = useState(user?.unit_id || '')
  const [companyId, setCompanyId] = useState(user?.company_id || '')
  const [platoonId, setPlatoonId] = useState(user?.platoon_id || '')
  // Role override UI removed; users are Members by default unless changed by admins
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: string; name: string }>>([])
  const [sectionOptions, setSectionOptions] = useState<Array<{ id: string; name: string }>>([])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rankOptions, setRankOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const md: any = (window as any).MilitaryData
    if (md && branch) {
      const options = md.getRanksForBranch?.(branch) || []
      setRankOptions(options)
    } else {
      setRankOptions([])
    }
  }, [branch])

  useEffect(() => {
    const loadCompanies = async () => {
      const uid = user?.unit_id || unitId
      if (!uid) { setCompanyOptions([]); return }
      const comps = await listCompanies(uid)
      const options = comps.map(c => ({ id: c.company_id, name: c.display_name || c.company_id }))
      const unique = Array.from(new Map(options.map(o => [o.id, o])).values())
      setCompanyOptions(unique)
    }
    loadCompanies()
  }, [user?.unit_id, unitId])

  useEffect(() => {
    const loadSections = async () => {
      const uid = user?.unit_id || unitId
      if (!uid || !companyId) { setSectionOptions([]); return }
      const secs = await listSections(uid)
      const filtered = secs.filter(s => (s as any).company_id === companyId)
      const opts = filtered.map(s => ({ id: String(s.id), name: (s as any).display_name || s.section_name }))
      setSectionOptions(opts)
      if (opts.length && !opts.find(o => o.id === platoonId)) setPlatoonId('')
    }
    loadSections()
  }, [user?.unit_id, unitId, companyId])
  
  const [theme, setTheme] = useState('dark')
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [fontSize, setFontSize] = useState('14')
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'editor' | 'password' | 'contact'>('profile')
  

  

  const handleSave = () => {
    // Save settings to localStorage or backend
    localStorage.setItem('settings', JSON.stringify({
      theme,
      notifications,
      autoSave,
      fontSize
    }))
    alert('Settings saved successfully!')
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-github-dark">
      {/* Header */}
      <header className="bg-github-gray bg-opacity-10 border-b border-github-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-white transition-colors mr-3"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <BrandMark />
            </div>
            <HeaderTools />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl overflow-hidden">
          <div className="flex border-b border-github-border overflow-x-auto">
            <button onClick={() => setActiveTab('profile')} className={`px-4 py-3 text-sm whitespace-nowrap ${activeTab==='profile'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Profile</button>
            <button onClick={() => setActiveTab('notifications')} className={`px-4 py-3 text-sm whitespace-nowrap ${activeTab==='notifications'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Notifications</button>
            <button onClick={() => setActiveTab('editor')} className={`px-4 py-3 text-sm whitespace-nowrap ${activeTab==='editor'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Editor</button>
            <button onClick={() => setActiveTab('contact')} className={`px-4 py-3 text-sm whitespace-nowrap ${activeTab==='contact'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Contact Info</button>
            <button onClick={() => setActiveTab('password')} className={`px-4 py-3 text-sm whitespace-nowrap ${activeTab==='password'?'text-white border-b-2 border-github-blue':'text-gray-400'}`}>Password</button>
          </div>
          <div className="p-6 space-y-8">
            {activeTab === 'profile' && (
              <div>
                <div className="flex items-center mb-6">
                  <User className="w-6 h-6 text-github-blue mr-3" />
                  <h2 className="text-xl font-semibold text-white">Profile | {user?.edipi || ''}</h2>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                      <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                      <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Middle Initial</label>
                      <input value={middleInitial} onChange={e => setMiddleInitial(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Branch</label>
                      <select
                        value={branch}
                        onChange={e => { setBranch(e.target.value); setRank('') }}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                      >
                        <option value="">Select branch</option>
                        {(((window as any).MilitaryData?.branches) || []).map((br: any) => (
                          <option key={br.value} value={br.value}>{br.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Rank</label>
                      <select
                        value={rank}
                        onChange={e => setRank(e.target.value)}
                        disabled={!branch}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                      >
                        <option value="">Select rank</option>
                        {rankOptions.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">MOS</label>
                      <input value={mos} onChange={e => setMos(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                    
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Unit</label>
                      <input value={unitId} disabled className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Company</label>
                      <select
                        value={companyId}
                        onChange={e => setCompanyId(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                      >
                        <option value="">Select company</option>
                        {companyOptions.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Section</label>
                      <select
                        value={platoonId}
                        onChange={e => setPlatoonId(e.target.value)}
                        className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white"
                      >
                        <option value="">Select section</option>
                        {sectionOptions.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={async () => {
                        if (!user) return
                        const patch = {
                          first_name: firstName || undefined,
                          middle_initial: middleInitial || undefined,
                          last_name: lastName || undefined,
                          branch: branch || undefined,
                          rank: rank || undefined,
                          mos: mos || user?.mos || '',
                          company_id: companyId || undefined,
                          platoon_id: platoonId || undefined,
                          
                        }
                        try {
                          if (import.meta.env.VITE_USE_SUPABASE === '1') {
                            await sbUpdateUser(user.user_id, patch)
                          }
                          const updated = { ...user, ...patch, updated_at_timestamp: new Date().toISOString() }
                          login(updated as any)
                          
                          alert('Profile updated')
                        } catch (e: any) {
                          alert(e?.message || 'Failed to update profile')
                        }
                      }}
                      className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'contact' && (
              <div>
                <div className="flex items-center mb-6">
                  <Mail className="w-6 h-6 text-github-blue mr-3" />
                  <h2 className="text-xl font-semibold text-white">Contact Info</h2>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                      <input value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                      <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={async () => {
                        if (!user) return
                        const patch = {
                          email: email || undefined,
                          phone_number: phoneNumber || undefined,
                        }
                        try {
                          if (import.meta.env.VITE_USE_SUPABASE === '1') {
                            await sbUpdateUser(user.user_id, patch as any)
                          }
                          const updated = { ...user, ...patch, updated_at_timestamp: new Date().toISOString() }
                          login(updated as any)
                          alert('Contact info updated')
                        } catch (e: any) {
                          alert(e?.message || 'Failed to update contact info')
                        }
                      }}
                      className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
                    >
                      Save Contact Info
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'password' && (
              <div>
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-github-blue mr-3" />
                  <h2 className="text-xl font-semibold text-white">Reset Password</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white" />
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    onClick={async () => {
                      if (!newPassword || !confirmPassword) { alert('Enter and confirm the new password'); return }
                      if (newPassword !== confirmPassword) { alert('Passwords do not match'); return }
                      const mod = await import('bcryptjs')
                      const bcrypt = (mod as any).default || mod
                      const hashed = await bcrypt.hash(newPassword, 12)
                      const updated = { ...user!, hashed_password: hashed, updated_at_timestamp: new Date().toISOString() }
                      login(updated as any)
                      setNewPassword('')
                      setConfirmPassword('')
                      alert('Password updated')
                    }}
                    className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
                  >
                    Update Password
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'appearance' && (
              <div>
                <div className="flex items-center mb-6">
                  <Palette className="w-6 h-6 text-github-blue mr-3" />
                  <h2 className="text-xl font-semibold text-white">Appearance</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Font Size</label>
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                    >
                      <option value="12">12px</option>
                      <option value="14">14px</option>
                      <option value="16">16px</option>
                      <option value="18">18px</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'notifications' && (
              <div>
                <div className="flex items-center mb-6">
                  <Bell className="w-6 h-6 text-github-blue mr-3" />
                  <h2 className="text-xl font-semibold text-white">Notifications</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Enable Notifications</h3>
                      <p className="text-gray-400 text-sm">Receive notifications about file changes and conflicts</p>
                    </div>
                    <button
                      onClick={() => setNotifications(!notifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        notifications ? 'bg-github-blue' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'editor' && (
              <div>
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-github-blue mr-3" />
                  <h2 className="text-xl font-semibold text-white">Editor</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Auto Save</h3>
                      <p className="text-gray-400 text-sm">Automatically save changes while editing</p>
                    </div>
                    <button
                      onClick={() => setAutoSave(!autoSave)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoSave ? 'bg-github-blue' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoSave ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

          

          
          
          
       </main>
    </div>
  )
}
