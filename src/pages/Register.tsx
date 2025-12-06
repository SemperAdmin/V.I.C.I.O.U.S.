import { useEffect, useState } from 'react'
import bcrypt from 'bcryptjs'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { canonicalize } from '@/utils/json'
import { sha256String } from '@/utils/crypto'
import { downloadJsonFile } from '@/utils/download'
import '@/js/military-data.js'
import { triggerCreateUserDispatch } from '@/services/workflowService'
import { loadUnitStructureFromBundle } from '@/utils/unitStructure'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [edipi, setEdipi] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [orgRole, setOrgRole] = useState<'Unit_Admin' | 'Section_Manager' | 'Member'>('Member')
  const [unitId, setUnitId] = useState('')
  const [mos, setMos] = useState('')
  const [branch, setBranch] = useState('')
  const [rank, setRank] = useState('')
  const [rankOptions, setRankOptions] = useState<{ value: string; label: string }[]>([])
  const [units, setUnits] = useState<{ id: string; name: string; uic?: string; ruc?: string; mcc?: string }[]>([])
  const [companyId, setCompanyId] = useState('')
  const [platoonId, setPlatoonId] = useState('')
  const [error, setError] = useState('')
  const [previewUser, setPreviewUser] = useState<any | null>(null)
  const [previewProgress, setPreviewProgress] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [platoons, setPlatoons] = useState<{ id: string; name: string }[]>([])

  const handleGenerate = async () => {
    setError('')
    if (!edipi || !password || !unitId || !mos) {
      setError('EDIPI, MOS, password, and unit are required')
      return
    }
    if (!/^\d{10}$/.test(edipi)) {
      setError('EDIPI must be 10 digits')
      return
    }
    if (!/^\d{4}$/.test(mos)) {
      setError('MOS must be 4 digits')
      return
    }
    if (branch && !rank) {
      setError('Please select a rank for the chosen branch')
      return
    }
    if (companies.length > 0 && !companyId) {
      setError('Please select a Company')
      return
    }
    if (platoons.length > 0 && !platoonId) {
      setError('Please select a Platoon')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const userId = String(Date.now())
      const hashed = await bcrypt.hash(password, 12)
      const now = new Date().toISOString()
      const userProfile = {
        user_id: userId,
        edipi,
        mos,
        branch: branch || undefined,
        rank: rank || undefined,
        org_role: orgRole,
        unit_id: unitId,
        company_id: companyId || undefined,
        platoon_id: platoonId || undefined,
        hashed_password: hashed,
        created_at_timestamp: now,
        updated_at_timestamp: now
      }
      setPreviewUser(userProfile)
      if (orgRole === 'Member') {
        const progress = {
          member_user_id: userId,
          unit_id: unitId,
          official_checkin_timestamp: now,
          current_file_sha: '',
          progress_tasks: []
        }
        const canonical = canonicalize(progress)
        const sha = await sha256String(canonical)
        progress.current_file_sha = sha
        setPreviewProgress(progress)
      } else {
        setPreviewProgress(null)
      }
    } catch {
      setError('Failed to generate files')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const mod: any = await import('@/utils/units')
        const list = (mod.UNITS || mod.units || mod.default || mod.getAllUnits?.() || []) as any[]
        const normalized = list.map((u: any, idx: number) => ({
          id: (u.uic || u.id || u.unit_id || u.code || String(u)) as string,
          name: u.unitName || u.name || u.title || String(u),
          uic: u.uic || '',
          ruc: u.ruc || '',
          mcc: u.mcc || '',
          _idx: idx
        }))
        const uniqueByUic = new Map<string, any>()
        for (const u of normalized) {
          const key = u.uic || u.id
          if (!key) continue
          if (!uniqueByUic.has(key)) uniqueByUic.set(key, u)
        }
        setUnits(Array.from(uniqueByUic.values()))
      } catch {
        setUnits([])
      }
    }
    loadUnits()
  }, [])

  useEffect(() => {
    const loadStructure = async () => {
      try {
        if (!unitId) { setCompanies([]); setPlatoons([]); return }
        const all = await loadUnitStructureFromBundle()
        const unitObj = units.find(u => u.id === unitId)
        let data: any = null
        if (unitObj?.uic && all[unitObj.uic]) data = all[unitObj.uic]
        else if (all[unitId]) data = all[unitId]
        if (!data) { setCompanies([]); setPlatoons([]); return }
        const comps = (data.companies || data.Companies || data.values?.companies || []) as any[]
        const normComps = comps.map((c: any) => ({ id: c.id || c.code || c.name, name: c.name || c.title || c.id }))
        setCompanies(normComps)
        const sel = comps.find((c: any) => (c.id || c.code || c.name) === companyId)
        const plats = (sel?.platoons || sel?.Platoons || sel?.values?.platoons || []) as any[]
        setPlatoons(plats.map((p: any) => ({ id: p.id || p.code || p.name, name: p.name || p.title || p.id })))
      } catch {
        setCompanies([])
        setPlatoons([])
      }
    }
    loadStructure()
  }, [unitId, companyId, units])

  const handleDownload = () => {
    if (previewUser) downloadJsonFile(`user_${previewUser.user_id}.json`, previewUser)
    if (previewProgress) downloadJsonFile(`progress_${previewProgress.member_user_id}.json`, previewProgress)
  }

  const handleLoginNow = () => {
    if (!previewUser) return
    login(previewUser)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-white mb-6">Create Account</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6">
            <input
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
              placeholder="EDIPI"
              value={edipi}
              onChange={e => setEdipi(e.target.value)}
            />
            <input
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
              placeholder="MOS (4 digits)"
              value={mos}
              onChange={e => setMos(e.target.value)}
              maxLength={4}
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Branch</label>
              <select
                className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                value={branch}
                onChange={e => {
                  const b = e.target.value
                  setBranch(b)
                  const md: any = (window as any).MilitaryData
                  const options = md?.getRanksForBranch?.(b) || []
                  setRankOptions(options)
                  setRank('')
                }}
              >
                <option value="">Select branch</option>
                {((window as any).MilitaryData?.branches || []).map((br: any) => (
                  <option key={br.value} value={br.value}>{br.label}</option>
                ))}
              </select>
            </div>
            {branch && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rank</label>
                <select
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                  value={rank}
                  onChange={e => setRank(e.target.value)}
                >
                  <option value="">Select rank</option>
                  {rankOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}
            <select
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
              value={orgRole}
              onChange={e => setOrgRole(e.target.value as any)}
            >
              <option value="Unit_Admin">Unit Admin</option>
              <option value="Section_Manager">Section Manager</option>
              <option value="Member">Member</option>
            </select>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
              <select
                className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                value={unitId}
                onChange={e => setUnitId(e.target.value)}
              >
                <option value="">Select unit</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.id}
                    {u.uic ? ` • UIC ${u.uic}` : ''}
                    {u.ruc ? ` • RUC ${u.ruc}` : ''}
                    {u.mcc ? ` • MCC ${u.mcc}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {companies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <select
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                >
                  <option value="">Select company</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {platoons.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Platoon</label>
                <select
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                  value={platoonId}
                  onChange={e => setPlatoonId(e.target.value)}
                >
                  <option value="">Select platoon</option>
                  {platoons.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <input
              type="password"
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <input
              type="password"
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
              placeholder="Confirm Password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
              >
                {busy ? 'Generating...' : 'Generate Files'}
              </button>
              <button
                onClick={handleLoginNow}
                disabled={!previewUser}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-50"
              >
                Login Now
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {(previewUser || previewProgress) && (
              <button
                onClick={async () => {
                  if (!previewUser) { alert('Generate files first'); return }
                  try {
                    await triggerCreateUserDispatch('SemperAdmin', 'Process-Point-Data', {
                      user: previewUser,
                      progress: previewProgress || undefined
                    })
                    // Also download the files locally (silent create) for records
                    downloadJsonFile(`user_${previewUser.user_id}.json`, previewUser)
                    if (previewProgress) {
                      downloadJsonFile(`progress_${previewProgress.member_user_id}.json`, previewProgress)
                    }
                    // Seamless: login and go to dashboard
                    login(previewUser)
                    navigate('/dashboard')
                  } catch (e: any) {
                    alert(`Submit failed: ${e?.message || 'Unknown error'}`)
                  }
                }}
                className="w-full px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
              >
                Submit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
