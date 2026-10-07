import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useNavigate } from 'react-router-dom'
import {
  GENDERS,
  EMPLOYMENT_STATUSES,
} from '../../../lib/constants'

const ROLES = ['Class Teacher', 'Subject Teacher', 'Head Teacher', 'Accountant', 'Secretary', 'Security', 'Cleaner', 'Other']

const StaffForm = () => {
  const { schoolId } = useAuthStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [createLogin, setCreateLogin] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [error, setError] = useState('')
  const [classes, setClasses] = useState([])
  const [arms, setArms] = useState([])
  const [selectedClasses, setSelectedClasses] = useState([])

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    state_of_origin: '',
    lga_of_origin: '',
    nationality: 'Nigerian',
    home_address: '',
    phone: '',
    email: '',
    staff_type: '',
    role: '',
    date_of_employment: new Date().toISOString().split('T')[0],
    employment_status: 'Active',
    qualification: '',
  })

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('*, arms(*)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('section').order('name')
      setClasses(data || [])
    }
    if (schoolId) fetchClasses()
  }, [schoolId])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleClassToggle = (classId, armId = null) => {
    const key = armId ? `${classId}_${armId}` : classId
    setSelectedClasses(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  const generateStaffId = async () => {
    const year = new Date().getFullYear()
    const { data, error } = await supabase.rpc('generate_staff_id', {
      p_school_id: schoolId
    })
    if (error) throw error
    return data
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const staffId = await generateStaffId()

      const { data: newStaff, error: staffError } = await supabase
        .from('staff')
        .insert([{ ...form, school_id: schoolId, staff_id: staffId }])
        .select()
        .single()

      if (staffError) throw staffError

      // Assign classes to teacher
      if (form.staff_type === 'Teaching' && selectedClasses.length > 0) {
  const assignments = selectedClasses.map(key => {
    const parts = key.split('_')
    return {
      staff_id: newStaff.id,
      class_id: parts[0],
      arm_id: parts[1] || null,
    }
  })
  await supabase.from('teacher_classes').insert(assignments)
}
      // Create login if requested
if (createLogin && tempPassword) {
  const staffRole = form.role === 'Head Teacher'
    ? 'Headmaster'
    : form.staff_type === 'Teaching'
    ? 'Teacher'
    : null

  
  if (!staffRole) {
    alert('Staff registered, but no login was created — logins are only available for Teaching staff and Head Teachers.')
  } else {
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
      password: tempPassword,
      staffId: newStaff.id,
      role: staffRole,
      schoolId: schoolId,
    }),
  }
)
const result = await response.json()
if (result.error) {
  console.error('Login creation error:', result.error)
  alert(`Staff registered but login creation failed: ${result.error}`)
}
  }
}

      navigate('/admin/staff')
    } catch (err) {
      setError(err.message || 'Failed to register staff. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Register Staff</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fill in the details to register a new staff member.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 max-w-3xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

        {/* Personal Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
              <input name="first_name" value={form.first_name} onChange={handleChange} required placeholder="First name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Middle Name</label>
              <input name="middle_name" value={form.middle_name} onChange={handleChange} placeholder="Middle name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
              <input name="last_name" value={form.last_name} onChange={handleChange} required placeholder="Last name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Gender <span className="text-red-500">*</span></label>
              <select name="gender" value={form.gender} onChange={handleChange} required className={inputClass}>
                <option value="">Select Gender</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Nationality</label>
              <input name="nationality" value={form.nationality} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State of Origin</label>
              <input name="state_of_origin" value={form.state_of_origin} onChange={handleChange} placeholder="e.g. Lagos" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>LGA of Origin</label>
              <input name="lga_of_origin" value={form.lga_of_origin} onChange={handleChange} placeholder="e.g. Ikeja" className={inputClass} />
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
              <textarea name="home_address" value={form.home_address} onChange={handleChange} rows={2} placeholder="Full home address" className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Phone Number <span className="text-red-500">*</span></label>
              <input name="phone" value={form.phone} onChange={handleChange} required placeholder="e.g. 08012345678" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Address <span className="text-red-500">*</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="staff@example.com" className={inputClass} />
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
              <label className={labelClass}>Staff Type <span className="text-red-500">*</span></label>
              <select name="staff_type" value={form.staff_type} onChange={handleChange} required className={inputClass}>
                <option value="">Select Type</option>
                <option value="Teaching">Teaching</option>
                <option value="Non-Teaching">Non-Teaching</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Role / Designation <span className="text-red-500">*</span></label>
              <select name="role" value={form.role} onChange={handleChange} required className={inputClass}>
                <option value="">Select Role</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date of Employment</label>
              <input type="date" name="date_of_employment" value={form.date_of_employment} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Employment Status</label>
              <select name="employment_status" value={form.employment_status} onChange={handleChange} className={inputClass}>
                {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Qualification</label>
              <input name="qualification" value={form.qualification} onChange={handleChange} placeholder="e.g. B.Ed, NCE, HND" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Class Assignment — Teaching Staff Only */}
        {form.staff_type === 'Teaching' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
              Class Assignment
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Select the class(es) this teacher will handle.
            </p>
            <div className="space-y-3">
              {classes.map((cls) => (
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
        {/* Login Creation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
        Login Access
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Create a system login for this staff member. Only needed for Teaching staff and Headmaster.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="checkbox"
          id="create_login"
          checked={createLogin}
          onChange={(e) => setCreateLogin(e.target.checked)}
          className="w-4 h-4 accent-primary"
        />
        <label htmlFor="create_login" className="text-sm font-medium text-gray-700">
          Create login account for this staff member
        </label>
      </div>

      {createLogin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Temporary Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Set a temporary password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            />
            <p className="text-xs text-gray-400 mt-1">
              Share this password with the staff member. They can change it after logging in.
            </p>
          </div>
          )}
        </div>
        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-light text-white font-semibold px-8 py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {saving ? 'Registering...' : 'Register Staff'}
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

export default StaffForm