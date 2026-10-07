import { useState } from 'react'
import ParentLayout from '../../components/layout/ParentLayout'
import { supabase } from '../../lib/supabase'
import { Lock } from 'lucide-react'

const ParentSettings = () => {
  const [form, setForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: form.newPassword
      })
      if (error) throw error
      setSuccess('Password changed successfully!')
      setForm({ newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ParentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account.</p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Lock size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Change Password</h2>
              <p className="text-xs text-gray-400">Update your login password</p>
            </div>
          </div>

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                placeholder="Enter new password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                placeholder="Confirm new password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </ParentLayout>
  )
}

export default ParentSettings