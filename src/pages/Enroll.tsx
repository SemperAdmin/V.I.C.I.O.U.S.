import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { listForms, UnitForm } from '@/utils/formsStore'
import { listSubTasks } from '@/utils/unitTasks'
import { createSubmission } from '@/utils/myFormSubmissionsStore'
import { sbCreateSubmission } from '@/services/supabaseDataService'
import BrandMark from '@/components/BrandMark'
import { UNITS } from '@/utils/units'

type UnitOption = {
  ruc: string
  uic: string
  mcc: string
  unitName: string
}

export default function Enroll() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<UnitForm | null>(null)
  const [creating, setCreating] = useState(false)
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([])
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null)

  const formId = searchParams.get('form')
  const unitId = searchParams.get('unit') // This is the RUC
  const kind = searchParams.get('kind') as 'Inbound' | 'Outbound' | null

  useEffect(() => {
    // If not authenticated, redirect to register with return URL
    if (!isAuthenticated || !user) {
      const returnUrl = `/enroll?form=${formId}&unit=${unitId}&kind=${kind}`
      navigate(`/register?return=${encodeURIComponent(returnUrl)}`)
      return
    }

    // Load the form details and units under this RUC
    const loadForm = async () => {
      if (!formId || !unitId) {
        setError('Invalid QR code - missing form or unit information')
        setLoading(false)
        return
      }

      try {
        // Load units that match this RUC
        const matchingUnits = UNITS.filter(u => u.ruc === unitId)
        if (matchingUnits.length > 0) {
          setUnitOptions(matchingUnits)
          setSelectedUnit(matchingUnits[0])
        } else {
          // If no exact RUC match, use the unitId as-is
          setUnitOptions([{ ruc: unitId, uic: '', mcc: '', unitName: unitId }])
          setSelectedUnit({ ruc: unitId, uic: '', mcc: '', unitName: unitId })
        }

        const forms = await listForms(unitId)
        const targetForm = forms.find(f => f.id === Number(formId))
        if (!targetForm) {
          setError('Form not found. It may have been deleted or the QR code is invalid.')
          setLoading(false)
          return
        }
        setForm(targetForm)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load form:', err)
        setError('Failed to load form details. Please try again.')
        setLoading(false)
      }
    }

    loadForm()
  }, [isAuthenticated, user, formId, unitId, kind, navigate])

  const handleStartProcess = async () => {
    if (!form || !user || creating || !selectedUnit) return

    setCreating(true)
    try {
      // Get task details
      const subTasks = await listSubTasks(unitId!)
      const taskMap: Record<string, { description: string }> = {}
      for (const st of subTasks) {
        taskMap[st.sub_task_id] = { description: st.description || st.sub_task_id }
      }

      // Create submission with selected unit info
      const tasks = (form.task_ids || []).map(tid => ({
        sub_task_id: tid,
        description: taskMap[tid]?.description || tid,
        status: 'Pending' as const,
      }))

      // Build unit identifier: UIC-RUC or just RUC
      const selectedUnitId = selectedUnit.uic
        ? `${selectedUnit.uic}-${selectedUnit.ruc}`
        : selectedUnit.ruc

      const submission = {
        user_id: user.user_id,
        unit_id: selectedUnitId,
        form_id: form.id,
        form_name: form.name,
        kind: form.kind,
        member: {
          edipi: user.edipi,
          rank: user.rank,
          first_name: user.first_name,
          last_name: user.last_name,
          company_id: user.company_id,
          platoon_id: user.platoon_id,
          unit_name: selectedUnit.unitName,
        },
        tasks,
        task_ids: form.task_ids,
        completed_count: 0,
        total_count: tasks.length,
        status: 'In_Progress' as const,
        arrival_date: form.kind === 'Inbound' ? new Date().toISOString().slice(0, 10) : undefined,
        departure_date: form.kind === 'Outbound' ? new Date().toISOString().slice(0, 10) : undefined,
      }

      if (import.meta.env.VITE_USE_SUPABASE === '1') {
        await sbCreateSubmission(submission as any)
      } else {
        await createSubmission(submission as any)
      }

      // Redirect to dashboard
      navigate('/my-dashboard')
    } catch (err: any) {
      console.error('Failed to create submission:', err)
      setError(err?.message || 'Failed to start process. Please try again.')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-github-dark flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-black border border-github-border rounded-xl p-6 text-center">
          <div className="flex justify-center mb-4"><BrandMark /></div>
          <h2 className="text-white text-xl mb-4">Error</h2>
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/my-dashboard')}
            className="px-6 py-2 bg-github-blue hover:bg-blue-600 text-white rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-github-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-black border border-github-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <BrandMark />
          <h1 className="text-white text-xl font-semibold">Process Point</h1>
        </div>

        <div className="border border-github-border rounded-lg p-4 mb-6">
          <h2 className="text-white text-lg mb-2">{form?.name}</h2>
          <div className="text-gray-400 text-sm space-y-1">
            <p><span className="text-gray-500">Type:</span> {form?.kind}</p>
            <p><span className="text-gray-500">Tasks:</span> {form?.task_ids.length}</p>
          </div>
        </div>

        {/* Unit Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Select Your Unit</label>
          {unitOptions.length > 1 ? (
            <select
              value={selectedUnit ? `${selectedUnit.uic}-${selectedUnit.ruc}` : ''}
              onChange={(e) => {
                const [uic, ruc] = e.target.value.split('-')
                const unit = unitOptions.find(u => u.uic === uic && u.ruc === ruc)
                if (unit) setSelectedUnit(unit)
              }}
              className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-github-blue"
            >
              {unitOptions.map(u => (
                <option key={`${u.uic}-${u.ruc}`} value={`${u.uic}-${u.ruc}`}>
                  {u.unitName} {u.uic && `(${u.uic})`}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white">
              {selectedUnit?.unitName || unitId}
            </div>
          )}
        </div>

        <div className="text-gray-300 text-sm mb-6">
          <p className="mb-2">Welcome, <span className="text-white">{user?.rank} {user?.first_name} {user?.last_name}</span>!</p>
          <p>Click below to start your {form?.kind?.toLowerCase()} process. You'll be able to track your progress from your dashboard.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleStartProcess}
            disabled={creating}
            className="w-full px-4 py-3 bg-github-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded font-medium"
          >
            {creating ? 'Starting...' : `Start ${form?.kind} Process`}
          </button>
          <button
            onClick={() => navigate('/my-dashboard')}
            className="w-full px-4 py-2 bg-github-gray bg-opacity-20 hover:bg-opacity-40 border border-github-border text-gray-300 rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
