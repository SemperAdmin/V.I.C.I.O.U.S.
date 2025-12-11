import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { canonicalize } from '@/utils/json'
import { sha256String } from '@/utils/crypto'
import '@/js/military-data.js'
import { triggerCreateUserDispatch } from '@/services/workflowService'
import { sbInsertUser, sbUpsertProgress } from '@/services/supabaseDataService'
import { listSections } from '@/utils/unitStructure'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()
  const returnUrl = searchParams.get('return') || '/dashboard'
  const [edipi, setEdipi] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [lastName, setLastName] = useState('')
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
  const [unitQuery, setUnitQuery] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)

  const handleGenerate = async () => {
    setError('')
    if (!edipi || !password || !unitId || !mos || !firstName || !lastName) {
      setError('EDIPI, MOS, password, unit, First and Last name are required')
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
    if (middleInitial && !/^[A-Za-z]$/.test(middleInitial)) {
      setError('Middle initial must be a single letter')
      return
    }
    setBusy(true)
    try {
      const userId = String(Date.now())
      const mod = await import('bcryptjs')
      const bcrypt = (mod as any).default || mod
      const hashed = await bcrypt.hash(password, 12)
      const now = new Date().toISOString()
      const userProfile = {
        user_id: userId,
        edipi,
        mos,
        first_name: firstName,
        middle_initial: middleInitial || undefined,
        last_name: lastName,
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
        const normalized = list.map((u: any, idx: number) => {
          const uic = u.uic || ''
          const ruc = u.ruc || ''
          const mcc = u.mcc || ''
          const combo = [uic, ruc, mcc].filter(Boolean).join('-')
          const id = combo || (u.id || u.unit_id || u.code || String(u))
          return {
            id: id as string,
            name: u.unitName || u.name || u.title || String(u),
            uic,
            ruc,
            mcc,
            _idx: idx
          }
        })
        const unique = new Map<string, any>()
        for (const u of normalized) {
          const key = `${u.uic}|${u.ruc}|${u.mcc}`
          if (!unique.has(key)) unique.set(key, u)
        }
        setUnits(Array.from(unique.values()))
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
        const unitObj = units.find(u => u.id === unitId)
        const ruc = String(unitObj?.ruc || unitId || '')
        const secs = await listSections(ruc)
        const companyIds = Array.from(new Set(secs.map(s => (s as any).company_id).filter(Boolean)))
        const normComps = companyIds.map(id => ({ id, name: id }))
        setCompanies(normComps)
        const selCompany = companyId || (normComps[0]?.id || '')
        if (!companyId && normComps[0]?.id) setCompanyId(normComps[0].id)
        const filteredSecs = selCompany ? secs.filter(s => (s as any).company_id === selCompany) : secs
        setPlatoons(filteredSecs.map(s => ({ id: s.section_name, name: (s as any).display_name || s.section_name })))
      } catch {
        setCompanies([])
        setPlatoons([])
      }
    }
    loadStructure()
  }, [unitId, companyId, units])

  

  const handleLoginNow = () => {
    if (!previewUser) return
    login(previewUser)
    navigate(returnUrl)
  }

  const handleSubmit = async () => {
    setError('')
    if (!edipi || !password || !unitId || !mos || !firstName || !lastName) {
      setError('EDIPI, MOS, password, unit, First and Last name are required')
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
    if (middleInitial && !/^[A-Za-z]$/.test(middleInitial)) {
      setError('Middle initial must be a single letter')
      return
    }
    setBusy(true)
    try {
      const userId = String(Date.now())
      const mod2 = await import('bcryptjs')
      const bcrypt2 = (mod2 as any).default || mod2
      const hashed = await bcrypt2.hash(password, 12)
      const now = new Date().toISOString()
      const userProfile = {
        user_id: userId,
        edipi,
        mos,
        first_name: firstName,
        middle_initial: middleInitial || undefined,
        last_name: lastName,
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
      const progress = orgRole === 'Member' ? (() => {
        const base = {
          member_user_id: userId,
          unit_id: unitId,
          official_checkin_timestamp: now,
          current_file_sha: '',
          progress_tasks: [] as any[]
        }
        return base
      })() : null
      if (progress) {
        const canonical = canonicalize(progress)
        const sha = await sha256String(canonical)
        progress.current_file_sha = sha
      }
      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        await sbInsertUser(userProfile as any)
        if (progress) await sbUpsertProgress(progress as any)
      } else {
        await triggerCreateUserDispatch('SemperAdmin', 'Process-Point-Data', {
          user: userProfile,
          progress: progress || undefined
        })
      }
      login(userProfile)
      navigate(returnUrl)
    } catch (e: any) {
      setError(e?.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-github-dark p-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Create Account</h1>
      <div className="space-y-4 bg-github-gray bg-opacity-10 border border-github-border rounded-xl p-6 h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                placeholder="First Name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
              <input
                className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                placeholder="Middle Initial"
                value={middleInitial}
                onChange={e => setMiddleInitial(e.target.value.toUpperCase().slice(0,1))}
                maxLength={1}
              />
              <input
                className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                placeholder="Last Name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rank</label>
                <select
                  className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
                  value={rank}
                  onChange={e => setRank(e.target.value)}
                  disabled={!branch}
                >
                  <option value="">Select rank</option>
                  {rankOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUnitOpen(!unitOpen)}
                    className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white text-left focus:outline-none focus:ring-2 focus:ring-github-blue"
                  >
                    {(() => {
                      const sel = units.find(u => u.id === unitId)
                      if (!sel) return 'Select unit'
                      const details = [sel.ruc && `RUC ${sel.ruc}`, sel.mcc && `MCC ${sel.mcc}`, sel.uic && `UIC ${sel.uic}`].filter(Boolean).join(' • ')
                      return `${sel.name}${details ? ' — ' + details : ''}`
                    })()}
                  </button>
                  {unitOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-black border border-github-border rounded-lg z-10">
                      <div className="p-2 border-b border-github-border">
                        <input
                          autoFocus
                          className="w-full px-3 py-2 bg-black border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
                          placeholder="Search by name/UIC/RUC/MCC/ID"
                          value={unitQuery}
                          onChange={e => setUnitQuery(e.target.value)}
                        />
                      </div>
                      <div className="max-h-48 overflow-auto bg-black">
                        {units.filter(u => {
                          const q = unitQuery.trim().toLowerCase()
                          return (
                            (u.name || '').toLowerCase().startsWith(q) ||
                            (u.id || '').toLowerCase().startsWith(q) ||
                            (u.uic || '').toLowerCase().startsWith(q) ||
                            (u.ruc || '').toLowerCase().startsWith(q) ||
                            (u.mcc || '').toLowerCase().startsWith(q)
                          )
                        }).map(u => (
                          <button
                            key={`dd-${u.id}`}
                            onMouseDown={() => { setUnitId(u.id); setUnitQuery(''); setUnitOpen(false) }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-700 text-white"
                          >
                            <div className="text-sm">{u.name}</div>
                            <div className="text-xs text-gray-400">{[u.ruc && `RUC ${u.ruc}`, u.mcc && `MCC ${u.mcc}`, u.uic && `UIC ${u.uic}`, u.id && `ID ${u.id}`].filter(Boolean).join(' • ')}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
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
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="flex-1 px-4 py-2 bg-github-blue hover:bg-blue-600 text-white rounded-lg"
              >
                {busy ? 'Submitting...' : 'Submit'}
              </button>
              <button
                onClick={() => navigate('/')}
                disabled={busy}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
      </div>
    </div>
  )
}
