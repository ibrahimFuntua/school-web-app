import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

const ParentList = () => {
  const { schoolId } = useAuthStore()
  const [parents, setParents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [resetting, setResetting] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Login creation state
  const [showLoginForm, setShowLoginForm] = useState(null)
  const [tempPassword, setTempPassword] = useState('')
  const [creatingLogin, setCreatingLogin] = useState(false)

  const fetchParents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('parents')
      .select(`
        *,
        parent_students(
          students(first_name, last_name, admission_number, classes(name))
        )
      `)
      .eq('school_id', schoolId)
      .order('full_name')
    setParents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchParents()
  }, [])

  const handleCreateLogin = async (parent) => {
    if (!tempPassword) return
    setCreatingLogin(true)
    setError('')
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-parent-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            parentId: parent.id,
            email: parent.email,
            fullName: parent.full_name,
            password: tempPassword,
          }),
        }
      )

      const result = await response.json()
      if (result.error) throw new Error(result.error)

      setSuccess(
        result.alreadyExists
          ? `Account already exists for ${parent.full_name} — linked successfully!`
          : `Login created for ${parent.full_name}!`
      )
      setShowLoginForm(null)
      setTempPassword('')
      await fetchParents()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(`Failed: ${err.message}`)
    } finally {
      setCreatingLogin(false)
    }
  }

  const handleSetPassword = async (parent) => {
    if (tempPassword.length < 6) return
    setResetting(parent.id)
    setError('')
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-set-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            targetType: 'parent',
            targetId: parent.id,
            password: tempPassword,
          }),
        }
      )
      const result = await response.json()
      if (result.error) throw new Error(result.error)

      setSuccess(`New password set for ${parent.full_name}. Please give it to them.`)
      setShowLoginForm(null)
      setTempPassword('')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(`Failed: ${err.message}`)
    } finally {
      setResetting(null)
    }
  }

  const filtered = parents.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading parents...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Parents</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage parent accounts and portal access.
        </p>
      </div>

      {success && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Parent</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Children</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Portal Access</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    No parents found.
                  </td>
                </tr>
              )}
              {filtered.map(parent => (
                <>
                  <tr key={parent.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {parent.full_name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{parent.email}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        {parent.parent_students?.map((ps, i) => (
                          <p key={i} className="text-xs text-gray-600">
                            {ps.students?.first_name} {ps.students?.last_name}
                            <span className="text-gray-400 ml-1">
                              ({ps.students?.classes?.name})
                            </span>
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {parent.auth_user_id ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-green-500" />
                          <span className="text-xs text-green-600 font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle size={14} className="text-gray-300" />
                          <span className="text-xs text-gray-400">No Access</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {parent.auth_user_id ? (
                        <button
                          onClick={() => {
                            setShowLoginForm(parent.id)
                            setTempPassword('')
                          }}
                          className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg transition disabled:opacity-60"
                        >
                          <RefreshCw size={12} />
                          Set New Password
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setShowLoginForm(parent.id)
                            setTempPassword('')
                          }}
                          className="text-xs bg-primary hover:bg-primary-light text-white px-3 py-1.5 rounded-lg transition"
                        >
                          + Create Login
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Inline Login Form */}
                  {showLoginForm === parent.id && (
                    <tr key={`${parent.id}-form`}>
                      <td colSpan={5} className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-medium text-gray-700">
                            {parent.auth_user_id ? 'Set a new password for' : 'Set password for'} {parent.full_name}:
                          </p>
                          <input
                            type="password"
                            value={tempPassword}
                            onChange={(e) => setTempPassword(e.target.value)}
                            placeholder="Enter temporary password"
                            className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => parent.auth_user_id ? handleSetPassword(parent) : handleCreateLogin(parent)}
                              disabled={creatingLogin || resetting === parent.id || tempPassword.length < 6}
                              className="bg-primary hover:bg-primary-light text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                            >
                              {creatingLogin || resetting === parent.id ? 'Saving...' : parent.auth_user_id ? 'Set Password' : 'Create Login'}
                            </button>
                            <button
                              onClick={() => {
                                setShowLoginForm(null)
                                setTempPassword('')
                              }}
                              className="px-4 py-2 border border-gray-300 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}

export default ParentList