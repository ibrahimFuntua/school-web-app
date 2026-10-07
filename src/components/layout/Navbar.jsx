import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { Bell, Menu } from 'lucide-react'
import { useEffect } from 'react'

const Navbar = ({ onMenuClick }) => {
  const { user, role, schoolId } = useAuthStore()
  const { currentSession, currentTerm, fetchCurrentTerm } = useTermStore()

  useEffect(() => {
    if (schoolId) fetchCurrentTerm(schoolId)
  }, [schoolId])

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 z-40">

      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition text-gray-600"
        >
          <Menu size={20} />
        </button>

        {/* Current Term */}
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

      {/* Right Side */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-full hover:bg-gray-100 transition">
          <Bell size={18} className="text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"></span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-700 leading-tight">
              {user?.email}
            </p>
            <p className="text-xs text-gray-400">{role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar