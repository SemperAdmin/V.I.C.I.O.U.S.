import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Bell, Palette, Shield, Save } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { loadUnitStructureFromBundle } from '@/utils/unitStructure'
import { downloadJsonFile } from '@/utils/download'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  
  const [theme, setTheme] = useState('dark')
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [fontSize, setFontSize] = useState('14')
  const [unitStructure, setUnitStructure] = useState<string>('')
  const [structureLoaded, setStructureLoaded] = useState(false)
  const [ghToken, setGhToken] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const all = await loadUnitStructureFromBundle()
        const data = all[user.unit_id]
        if (data) {
          setUnitStructure(JSON.stringify(data, null, 2))
        } else {
          setUnitStructure(JSON.stringify({ unit_id: user.unit_id, values: {} }, null, 2))
        }
      } catch {
        setUnitStructure(JSON.stringify({ unit_id: user.unit_id, values: {} }, null, 2))
      } finally {
        setStructureLoaded(true)
      }
    }
    load()
    const token = localStorage.getItem('GH_TOKEN') || ''
    setGhToken(token ? token.replace(/.(?=.{4})/g, '*') : '')
  }, [user])

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
              <h1 className="text-xl font-semibold text-white">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* User Profile */}
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
            <div className="flex items-center mb-6">
              <User className="w-6 h-6 text-github-blue mr-3" />
              <h2 className="text-xl font-semibold text-white">Profile</h2>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">{user?.edipi}</h3>
              <p className="text-gray-400 text-sm">Role: {user?.org_role}</p>
              <p className="text-gray-400 text-sm">MOS: {user?.mos}</p>
              <p className="text-gray-400 text-sm">Unit: {user?.unit_id}</p>
              {user?.company_id && <p className="text-gray-400 text-sm">Company: {user.company_id}</p>}
              {user?.platoon_id && <p className="text-gray-400 text-sm">Platoon: {user.platoon_id}</p>}
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
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

          {/* Notifications */}
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
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

          {/* Editor */}
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
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

          {/* Unit Structure (Unit Admin) */}
          {user?.org_role === 'Unit_Admin' && (
            <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Unit Structure</h2>
              {!structureLoaded ? (
                <div className="text-gray-400">Loading unit structure...</div>
              ) : (
                <div className="space-y-4">
                  <Editor
                    height="400px"
                    defaultLanguage="json"
                    value={unitStructure}
                    onChange={(v) => setUnitStructure(v || '')}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        let parsed: any
                        try { parsed = JSON.parse(unitStructure) } catch { alert('Invalid JSON'); return }
                        downloadJsonFile(`${user!.unit_id}_unit_structure.json`, parsed)
                      }}
                      className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
                    >
                      Download JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Sign Out
            </button>
            
            <button
              onClick={handleSave}
              className="flex items-center px-6 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </button>
          </div>

          {/* Integrations */}
          <div className="bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6 mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">Integrations</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">GitHub Token (PAT)</label>
                <input
                  type="password"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="Paste token to enable repository_dispatch"
                  className="w-full px-3 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      if (!ghToken) { alert('Enter a token'); return }
                      // Store raw when user types; if masked, ask to re-enter
                      if (ghToken.includes('*')) { alert('Please paste full token value'); return }
                      localStorage.setItem('GH_TOKEN', ghToken)
                      setGhToken(ghToken.replace(/.(?=.{4})/g, '*'))
                      alert('Token saved locally')
                    }}
                    className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
                  >
                    Save Token
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('GH_TOKEN')
                      setGhToken('')
                      alert('Token cleared')
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Clear Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
