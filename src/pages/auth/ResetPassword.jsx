import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ResetPassword = () => {
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    const timer = setTimeout(() => setExpired(true), 5000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) return setError(updateError.message)

    setDone(true)
    await supabase.auth.signOut()
    setTimeout(() => { window.location.href = '/login' }, 2000)
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold text-primary mb-1">Set a New Password</h1>

        {done ? (
          <p className="text-sm text-green-600 mt-4">
            Password updated! Taking you to the login page...
          </p>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className={inputClass}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={saving || !password || !confirm}
              className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        ) : expired ? (
          <div className="mt-4">
            <p className="text-sm text-red-600 mb-3">
              This reset link is invalid or has expired. Please request a new one.
            </p>
            <a href="/login" className="text-sm text-primary font-medium">Back to login</a>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-4">Verifying your reset link...</p>
        )}
      </div>
    </div>
  )
}

export default ResetPassword