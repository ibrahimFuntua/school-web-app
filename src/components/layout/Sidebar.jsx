import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

import {
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  GraduationCap,
  Wallet,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Users2
} from 'lucide-react'
import { useState } from 'react'



const SidebarItem = ({ item, onClose }) => {
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
      isActive
        ? 'bg-accent text-white'
        : 'text-blue-100 hover:bg-primary-light hover:text-white'
    }`

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-primary-light hover:text-white transition"
        >
          <span className="flex items-center gap-3">
            <item.icon size={18} />
            {item.label}
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {open && (
          <div className="ml-7 mt-1 space-y-1">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={linkClass}
                onClick={onClose}
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink to={item.path} className={linkClass} onClick={onClose}>
      <item.icon size={18} />
      {item.label}
    </NavLink>
  )
}

const Sidebar = ({ isOpen, onClose }) => {
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.role)
  const schoolName = useAuthStore((s) => s.schoolName)
  const schoolLogo = useAuthStore((s) => s.schoolLogo)
  const navigate = useNavigate()

  const adminNavItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    {
      label: 'Students', icon: Users,
      children: [
        { label: 'All Students', path: '/admin/students' },
        { label: 'Enroll Student', path: '/admin/students/enroll' },
        { label: 'Promote Students', path: '/admin/students/promote' },
      ],
    },
    {
      label: 'Staff', icon: UserCog,
      children: [
        { label: 'All Staff', path: '/admin/staff' },
        { label: 'Register Staff', path: '/admin/staff/register' },
      ],
    },
    {
      label: 'Classes & Subjects', icon: BookOpen,
      children: [
        { label: 'Classes', path: '/admin/classes' },
        { label: 'Subjects', path: '/admin/subjects' },
      ],
    },
    {
      label: 'Fees', icon: Wallet,
      children: [
        { label: 'Fee Structure', path: '/admin/fees' },
        { label: 'Record Payment', path: '/admin/fees/payment' },
        { label: 'Fee Reports', path: '/admin/fees/reports' },
      ],
    },
    { label: 'Parents', icon: Users2, path: '/admin/parents' },
    { label: 'Sessions & Terms', icon: GraduationCap, path: '/admin/sessions' },
    { label: 'Announcements', icon: Bell, path: '/admin/announcements' },
    { label: 'School Settings', icon: Settings, path: '/admin/settings' },
  ]

  const headmasterNavItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/headmaster/dashboard' },
    { label: 'Report Cards', icon: FileText, path: '/headmaster/report-cards' },
    { label: 'Students', icon: Users, path: '/admin/students' },
    { label: 'Staff', icon: UserCog, path: '/admin/staff' },
    { label: 'Fee Reports', icon: Wallet, path: '/admin/fees/reports' },
    { label: 'School Settings', icon: Settings, path: '/admin/settings' },
  ]

  const navItems = role === 'Headmaster' ? headmasterNavItems : adminNavItems

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-dvh w-64 bg-primary flex flex-col z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>

        {/* Logo + Close button on mobile */}
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
              <p className="text-blue-300 text-xs">Management System</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden text-blue-200 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarItem key={item.label} item={item} onClose={onClose} />
          ))}
        </nav>

        {/* Logout */}
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
    </>
  )
}

export default Sidebar