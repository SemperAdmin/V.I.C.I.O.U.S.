import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getUserByEdipi, verifyPassword } from '@/services/localDataService'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [edipi, setEdipi] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      if (!/^\d{10}$/.test(edipi)) {
        setError('EDIPI must be 10 digits')
        return
      }
      const profile = await getUserByEdipi(edipi)
      if (!profile) {
        setError('Invalid credentials')
        return
      }
      const ok = await verifyPassword(password, profile.hashed_password)
      if (!ok) {
        setError('Invalid credentials')
        return
      }
      login(profile as any)
      navigate('/my-dashboard')
    } catch {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-github-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-github-gray bg-opacity-10 border border-github-border rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Process Point</h1>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="EDIPI"
            value={edipi}
            onChange={(e) => setEdipi(e.target.value)}
            className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-github-gray bg-opacity-20 border border-github-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-github-blue"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full px-4 py-2 bg-github-blue hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="text-center">
            <Link to="/register" className="text-sm text-gray-400 hover:text-white">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
