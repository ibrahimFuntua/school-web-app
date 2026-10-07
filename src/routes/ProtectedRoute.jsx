import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuthStore()

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-primary font-semibold text-lg animate-pulse">
        Loading...
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

export default ProtectedRoute