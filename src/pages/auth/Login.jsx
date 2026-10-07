import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ROLES } from '../../lib/constants'

const Login = () => {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const role = await login(email, password)
      if (role === ROLES.ADMIN) navigate('/admin/dashboard')
      else if (role === ROLES.HEADMASTER) navigate('/headmaster/dashboard')
      else if (role === ROLES.TEACHER) navigate('/teacher/dashboard')
      else if (role === ROLES.PARENT) navigate('/parent/dashboard')
      else setError('Your account has no role assigned. Contact admin.')
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <span className="text-white font-bold text-xl">SMS</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">School Management</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          School Management System © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

export default Login