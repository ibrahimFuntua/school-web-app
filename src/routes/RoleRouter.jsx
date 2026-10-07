import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const RoleRouter = () => {
  const { role } = useAuthStore()

  if (role === 'Admin') return <Navigate to="/admin/dashboard" replace />
  if (role === 'Headmaster') return <Navigate to="/headmaster/dashboard" replace />
  if (role === 'Teacher') return <Navigate to="/teacher/dashboard" replace />
  if (role === 'Parent') return <Navigate to="/parent/dashboard" replace />

  return <Navigate to="/login" replace />
}

export default RoleRouter