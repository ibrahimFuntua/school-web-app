import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { GENDERS, EMPLOYMENT_STATUSES } from '../../../lib/constants'
import { ArrowLeft, Save } from 'lucide-react'

const ROLES = ['Class Teacher', 'Subject Teacher', 'Head Teacher', 'Accountant', 'Secretary', 'Security', 'Cleaner', 'Other']

const StaffProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [classes, setClasses] = useState([])
  const [selectedClasses, setSelectedClasses] = useState([])
  const [schoolId, setSchoolId] = useState(null)
  const [hasLogin, setHasLogin] = useState(false)
  const [creatingLogin, setCreatingLogin] = useState(false)
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [newTempPassword, setNewTempPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState('')

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setForm(data)
        setSchoolId(data.school_id)

        // Check if staff already has a login
        if (data.auth_user_id) {
          setHasLogin(true)
        }

        // Fetch assigned classes
        const { data: assignedData } = await supabase
          .from('teacher_classes')
          .select('class_id, arm_id')
          .eq('staff_id', id)

        setSelectedClasses(
          assignedData?.map(a =>
            a.arm_id ? `${a.class_id}_${a.arm_id}` : a.class_id
          ) || []
        )

        // Fetch all classes
        const { data: classData } = await supabase
          .from('classes')
          .select('*, arms(*)')
          .eq('school_id', data.school_id)
          .eq('is_active', true)
          .order('section').order('name')
        setClasses(classData || [])
      }
      setLoading(false)
    }
    fetchStaff()
  }, [id])

  const handleCreateLogin = async () => {
    if (!newTempPassword) return
    setCreatingLogin(true)
    try {
      const staffRole = form.role === 'Head Teacher'
        ? 'Headmaster'
        : form.staff_type === 'Teaching'
        ? 'Teacher'
        : null

      if (!staffRole) {
        setError('Only Teaching staff and Head Teachers can have logins.')
        setCreatingLogin(false)
        return
      }

      const { data: { session: authSession } } = await supabase.auth.getSession()
      const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authSession.access_token}`,
    },
    body: JSON.stringify({
      email: form.email,
      password: newTempPassword,
      staffId: id,
      role: staffRole,
      schoolId: schoolId,
    }),
  }
)
const result = await response.json()
if (result.error) throw new Error(result.error)


      setHasLogin(true)
      setShowLoginForm(false)
      setNewTempPassword('')
      setLoginSuccess('Login created successfully! Staff can now sign in.')
      setTimeout(() => setLoginSuccess(''), 4000)
    } catch (err) {
      setError(`Failed to create login: ${err.message}`)
    } finally {
      setCreatingLogin(false)
    }
  }

  const handleSetPassword = async () => {
    if (newTempPassword.length < 6) return
    setResettingPassword(true)
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
            targetType: 'staff',
            targetId: id,
            password: newTempPassword,
          }),
        }
      )
      const result = await response.json()
      if (result.error) throw new Error(result.error)

      setShowLoginForm(false)
      setNewTempPassword('')
      setLoginSuccess('New password set. Please give it to the staff member.')
      setTimeout(() => setLoginSuccess(''), 4000)
    } catch (err) {
      setError(`Failed to set password: ${err.message}`)
    } finally {
      setResettingPassword(false)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleClassToggle = (classId, armId = null) => {
    const key = armId ? `${classId}_${armId}` : classId
    setSelectedClasses(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('staff')
        .update({
          first_name: form.first_name,
          middle_name: form.middle_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          state_of_origin: form.state_of_origin,
          lga_of_origin: form.lga_of_origin,
          nationality: form.nationality,
          home_address: form.home_address,
          phone: form.phone,
          email: form.email,
          staff_type: form.staff_type,
          role: form.role,
          date_of_employment: form.date_of_employment,
          employment_status: form.employment_status,
          qualification: form.qualification,
          updated_at: new Date(),
        })
        .eq('id', id)

      if (updateError) throw updateError

      // Update class assignments if teaching staff
      if (form.staff_type === 'Teaching') {
  const { error: deleteError } = await supabase.from('teacher_classes').delete().eq('staff_id', id)
  if (deleteError) throw deleteError
  if (selectedClasses.length > 0) {
    const assignments = selectedClasses.map(key => {
      const parts = key.split('_')
      return {
        staff_id: id,
        class_id: parts[0],
        arm_id: parts[1] || null,
      }
    })
    const { error: insertError } = await supabase.from('teacher_classes').insert(assignments)
    if (insertError) {
      throw new Error('Class list was cleared but could not be updated — please re-select and save again.')
    }
  }
}

      setSuccess('Staff information updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to update staff information.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading staff...</p>
    </AdminLayout>
  )

  if (!form) return (
    <AdminLayout>
      <p className="text-red-500">Staff not found.</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/staff')}
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {form.first_name} {form.last_name}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {form.staff_id} · {form.staff_type}
          </p>
        </div>
      </div>

      {success && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 max-w-3xl">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 max-w-3xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">

        {/* Personal Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <input name="first_name" value={form.first_name || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Middle Name</label>
              <input name="middle_name" value={form.middle_name || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input name="last_name" value={form.last_name || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" name="date_of_birth" value={form.date_of_birth || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select name="gender" value={form.gender || ''} onChange={handleChange} className={inputClass}>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Nationality</label>
              <input name="nationality" value={form.nationality || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State of Origin</label>
              <input name="state_of_origin" value={form.state_of_origin || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>LGA of Origin</label>
              <input name="lga_of_origin" value={form.lga_of_origin || ''} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Home Address</label>
              <textarea name="home_address" value={form.home_address || ''} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="phone" value={form.phone || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="email" value={form.email || ''} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Employment */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Employment Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Staff ID</label>
              <input value={form.staff_id || ''} disabled className={`${inputClass} bg-gray-50 text-gray-400`} />
            </div>
            <div>
              <label className={labelClass}>Staff Type</label>
              <select name="staff_type" value={form.staff_type || ''} onChange={handleChange} className={inputClass}>
                <option value="Teaching">Teaching</option>
                <option value="Non-Teaching">Non-Teaching</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select name="role" value={form.role || ''} onChange={handleChange} className={inputClass}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Employment Status</label>
              <select name="employment_status" value={form.employment_status || ''} onChange={handleChange} className={inputClass}>
                {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date of Employment</label>
              <input type="date" name="date_of_employment" value={form.date_of_employment || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Qualification</label>
              <input name="qualification" value={form.qualification || ''} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Class Assignment */}
        {form.staff_type === 'Teaching' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
              Class Assignment
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Update the classes this teacher handles.
            </p>
            <div className="space-y-3">
              {classes.map(cls => (
                <div key={cls.id}>
                  {!cls.has_arms ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => handleClassToggle(cls.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-gray-700">
                        {cls.name}
                        <span className="text-xs text-gray-400 ml-2">({cls.section})</span>
                      </span>
                    </label>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        {cls.name} <span className="text-xs text-gray-400">({cls.section})</span>
                      </p>
                      <div className="ml-4 space-y-1">
                        {cls.arms?.filter(a => a.is_active).map(arm => (
                          <label key={arm.id} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedClasses.includes(`${cls.id}_${arm.id}`)}
                              onChange={() => handleClassToggle(cls.id, arm.id)}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm text-gray-700">
                              {cls.name} {arm.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Login Management */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Login Access
          </h2>

          {loginSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              {loginSuccess}
            </div>
          )}

          {hasLogin ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-sm text-gray-700">
                  This staff member has an active login account.
                </p>
              </div>
              {!showLoginForm ? (
                <button
                  type="button"
                  onClick={() => setShowLoginForm(true)}
                  className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  🔑 Set New Password
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newTempPassword}
                    onChange={(e) => setNewTempPassword(e.target.value)}
                    placeholder="New password (at least 6 characters)"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSetPassword}
                      disabled={resettingPassword || newTempPassword.length < 6}
                      className="bg-primary hover:bg-primary-light text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60"
                    >
                      {resettingPassword ? 'Saving...' : 'Set Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowLoginForm(false); setNewTempPassword('') }}
                      className="px-5 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <p className="text-sm text-gray-500">No login account yet.</p>
              </div>
              {!showLoginForm ? (
                <button
                  type="button"
                  onClick={() => setShowLoginForm(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  + Create Login Account
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      value={newTempPassword}
                      onChange={(e) => setNewTempPassword(e.target.value)}
                      placeholder="Set a temporary password"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateLogin}
                      disabled={creatingLogin || !newTempPassword}
                      className="bg-primary hover:bg-primary-light text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60"
                    >
                      {creatingLogin ? 'Creating...' : 'Create Login'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLoginForm(false)}
                      className="px-5 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-8 py-2.5 rounded-lg transition disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/staff')}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>

      </form>
    </AdminLayout>
  )
}

export default StaffProfile