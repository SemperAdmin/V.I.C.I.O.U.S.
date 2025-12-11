import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import MyDashboard from './pages/MyDashboard'
import FileEditor from './pages/FileEditor'
import HistoryView from './pages/HistoryView'
import Settings from './pages/Settings'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import UnitAdminDashboard from './pages/UnitAdminDashboard'
import CompanyManagerDashboard from './pages/CompanyManagerDashboard'
import UnitManagerDashboard from './pages/UnitManagerDashboard'
import SectionManagerDashboard from './pages/SectionManagerDashboard'
import TaskManagerDashboard from './pages/TaskManagerDashboard'
import Enroll from './pages/Enroll'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-github-dark text_white">
        <Routes>
          <Route path="/" element={isAuthenticated ? <MyDashboard /> : <LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-dashboard" element={<MyDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/unit-admin" element={<UnitAdminDashboard />} />
          <Route path="/unit-manager" element={<UnitManagerDashboard />} />
          <Route path="/company-manager" element={<CompanyManagerDashboard />} />
          <Route path="/section-manager" element={<SectionManagerDashboard />} />
          <Route path="/task-manager" element={<TaskManagerDashboard />} />
          <Route path="/editor/:owner/:repo/*" element={<FileEditor />} />
          <Route path="/history/:owner/:repo/*" element={<HistoryView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/register" element={<Register />} />
          <Route path="/enroll" element={<Enroll />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </div>
    </Router>
  )
}

export default App
