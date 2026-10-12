import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

// Shown once to anyone who was given a temporary password.
const ChangePassword = () => {
  const { user, loading, setUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-primary font-semibold text-lg animate-pulse">Loading...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!user.user_metadata?.must_change_password) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Your new password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setSaving(true)
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    setUser(data.user)
    navigate('/', { replace: true })
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <h1 className="text-xl font-bold text-primary mb-1">Choose your own password</h1>
        <p className="text-sm text-gray-500 mb-6">
          You signed in with a temporary password. Please choose a new one that only you know before you continue.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save and continue'}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Log out instead
        </button>
      </div>
    </div>
  )
}

export default ChangePassword