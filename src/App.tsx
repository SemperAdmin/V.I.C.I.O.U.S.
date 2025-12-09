import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import FileEditor from './pages/FileEditor'
import HistoryView from './pages/HistoryView'
import Settings from './pages/Settings'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import UnitAdminDashboard from './pages/UnitAdminDashboard'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen bg-github-dark text-white">
        <Routes>
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/unit-admin" element={<UnitAdminDashboard />} />
          <Route path="/editor/:owner/:repo/*" element={<FileEditor />} />
          <Route path="/history/:owner/:repo/*" element={<HistoryView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </div>
    </Router>
  )
}

export default App
