import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useEffect } from 'react'
import OfflineBanner from '../shared/OfflineBanner'
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Wallet,
  FileText,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  Megaphone,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/parent/dashboard' },
  { label: 'Attendance', icon: ClipboardList, path: '/parent/attendance' },
  { label: 'Grades', icon: BookOpen, path: '/parent/grades' },
  { label: 'Fees', icon: Wallet, path: '/parent/fees' },
  { label: 'Report Card', icon: FileText, path: '/parent/report-card' },
  { label: 'Announcements', icon: Megaphone, path: '/parent/announcements' },
  { label: 'Settings', icon: Settings, path: '/parent/settings' },
]

const ParentLayout = ({ children, onChildChange, children: layoutChildren }) => {
  const { user, role, schoolId, logout } = useAuthStore()
  const schoolName = useAuthStore((s) => s.schoolName)
  const schoolLogo = useAuthStore((s) => s.schoolLogo)
  const { currentSession, currentTerm, fetchCurrentTerm } = useTermStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (schoolId) fetchCurrentTerm(schoolId)
  }, [schoolId])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
      isActive
        ? 'bg-accent text-white'
        : 'text-blue-100 hover:bg-primary-light hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-background">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-dvh w-64 bg-primary flex flex-col z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="px-6 py-6 border-b border-primary-light flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {schoolLogo ? (
            <img
              src={schoolLogo}
              alt="Logo"
              className="w-9 h-9 rounded-full object-contain bg-white p-0.5"
            />
          ) : (
  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
    <span className="text-white font-bold text-xs">
      {schoolName?.charAt(0) || 'S'}
    </span>
  </div>
)}
<div className="min-w-0">
  <p className="text-white font-bold text-sm leading-tight truncate">
    {schoolName || 'School'}
  </p>
  <p className="text-blue-300 text-xs">Parent Portal</p>
</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-blue-200 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={linkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-primary-light">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-red-500 hover:text-white transition"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top Navbar */}
      <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 z-40">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
          >
            <Menu size={20} />
          </button>
          {currentSession && currentTerm ? (
            <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
              {currentSession.name} — {currentTerm.name}
            </span>
          ) : (
            <span className="bg-yellow-50 text-yellow-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              No active term
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-700 leading-tight">{user?.email}</p>
            <p className="text-xs text-gray-400">Parent</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <OfflineBanner />
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default ParentLayout