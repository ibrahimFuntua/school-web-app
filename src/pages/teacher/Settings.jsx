import { useState } from 'react'
import TeacherLayout from '../../components/layout/TeacherLayout'
import { supabase } from '../../lib/supabase'
import { Lock } from 'lucide-react'

const TeacherSettings = () => {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: form.newPassword,
      })

      if (error) throw error

      setSuccess('Password changed successfully!')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TeacherLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your account settings.
        </p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Lock size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Change Password
              </h2>
              <p className="text-xs text-gray-400">
                Update your login password
              </p>
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
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                required
                placeholder="Enter new password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
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
              {saving ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </TeacherLayout>
  )
}

export default TeacherSettings