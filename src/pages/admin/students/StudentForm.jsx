import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useNavigate } from 'react-router-dom'
import {
  GENDERS,
  SECTIONS,
  GUARDIAN_RELATIONSHIPS,
} from '../../../lib/constants'

const StudentForm = () => {
  const { schoolId } = useAuthStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [classes, setClasses] = useState([])
  const [arms, setArms] = useState([])
  const [sessions, setSessions] = useState([])
  const [parentCredentials, setParentCredentials] = useState(null)

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    return pwd
  }

  // Pre-filled with a random password; the admin can overwrite it
  const [guardianPassword, setGuardianPassword] = useState(generateTempPassword)

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    state_of_origin: '',
    lga_of_origin: '',
    nationality: 'Nigerian',
    religion: '',
    blood_group: '',
    genotype: '',
    home_address: '',
    lga_of_residence: '',
    state_of_residence: '',
    section: '',
    class_id: '',
    arm_id: '',
    session_id: '',
    admission_date: new Date().toISOString().split('T')[0],
    guardian_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_occupation: '',
    medical_conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
      setSessions(sessionData || [])
    }
    if (schoolId) fetchData()
  }, [schoolId])

  // Fetch classes when section changes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!form.section) return
      const { data } = await supabase
        .from('classes')
        .select('*, arms(*)')
        .eq('school_id', schoolId)
        .eq('section', form.section)
        .eq('is_active', true)
        .order('name')
      setClasses(data || [])
      setForm(f => ({ ...f, class_id: '', arm_id: '' }))
    }
    fetchClasses()
  }, [form.section])

  // Fetch arms when class changes
  useEffect(() => {
    const selected = classes.find(c => c.id === form.class_id)
    setArms(selected?.arms?.filter(a => a.is_active) || [])
    setForm(f => ({ ...f, arm_id: '' }))
  }, [form.class_id])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (guardianPassword.trim() && guardianPassword.trim().length < 6) {
      setError('Parent temporary password must be at least 6 characters.')
      return
    }

    setSaving(true)

    try {
      // Generate admission number
      const { data: admissionNumber, error: admError } = await supabase
        .rpc('generate_admission_number', { p_school_id: schoolId })
      if (admError) throw admError

      // Generate student ID (simple unique ID)
      const studentId = `STD-${Date.now()}`

      const payload = {
        ...form,
        school_id: schoolId,
        admission_number: admissionNumber,
        student_id: studentId,
        arm_id: form.arm_id || null,
        status: 'Active',
      }

      const { data: newStudent, error: insertError } = await supabase
  .from('students')
  .insert([payload])
  .select()
  .single()

if (insertError) throw insertError

      // Link (or create) a parent account from the guardian email.
      // The student is already saved at this point, so a problem here is
      // reported separately instead of failing the whole enrollment.
      let showedModal = false
      if (form.guardian_email) {
        try {
          const { data: existingParent } = await supabase
            .from('parents')
            .select('*')
            .eq('email', form.guardian_email)
            .maybeSingle()

          if (existingParent) {
            // Email already known: just link this student, no new password
            await supabase.from('parent_students')
              .insert([{ parent_id: existingParent.id, student_id: newStudent.id }])
            setParentCredentials({
              name: existingParent.full_name,
              email: existingParent.email,
              linked: true,
            })
            showedModal = true
          } else {
            const tempPassword = guardianPassword.trim() || generateTempPassword()
            const { data: newParent, error: parentInsertError } = await supabase
              .from('parents')
              .insert([{
                full_name: form.guardian_name,
                email: form.guardian_email,
                phone: form.guardian_phone,
              }])
              .select()
              .single()

            if (parentInsertError?.code === '23505') {
              // Another enrollment created this exact email a moment ago:
              // link to that record instead of failing
              const { data: raceParent } = await supabase
                .from('parents')
                .select('*')
                .eq('email', form.guardian_email)
                .single()
              await supabase.from('parent_students')
                .insert([{ parent_id: raceParent.id, student_id: newStudent.id }])
              setParentCredentials({
                name: raceParent.full_name,
                email: raceParent.email,
                linked: true,
              })
              showedModal = true
            } else if (parentInsertError) {
              throw parentInsertError
            } else {
              await supabase.from('parent_students')
                .insert([{ parent_id: newParent.id, student_id: newStudent.id }])

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
                    parentId: newParent.id,
                    email: form.guardian_email,
                    fullName: form.guardian_name,
                    password: tempPassword,
                  }),
                }
              )
              const result = await response.json()
              if (result.error) {
                alert(`Student enrolled, but the parent login could not be created: ${result.error}`)
              } else {
                setParentCredentials({
                  name: form.guardian_name,
                  email: form.guardian_email,
                  password: tempPassword,
                  linked: false,
                })
                showedModal = true
              }
            }
          }
        } catch (parentErr) {
          console.error('Parent account error:', parentErr)
          alert(`Student enrolled, but the parent account could not be set up: ${parentErr.message}`)
        }
      }

      // If the credentials modal is showing, its "Done" button navigates
      if (!showedModal) navigate('/admin/students')
    } catch (err) {
      setError(err.message || 'Failed to enroll student. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Enroll Student</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fill in the details to enroll a new student.
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
              <label className={labelClass}>Date of Birth <span className="text-red-500">*</span></label>
              <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} required className={inputClass} />
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
            <div>
              <label className={labelClass}>Religion</label>
              <input name="religion" value={form.religion} onChange={handleChange} placeholder="e.g. Christianity" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Blood Group</label>
              <select name="blood_group" value={form.blood_group} onChange={handleChange} className={inputClass}>
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Genotype</label>
              <select name="genotype" value={form.genotype} onChange={handleChange} className={inputClass}>
                <option value="">Select</option>
                {['AA', 'AS', 'SS', 'AC', 'SC'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Address
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Home Address</label>
              <textarea name="home_address" value={form.home_address} onChange={handleChange} rows={2} placeholder="Full home address" className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>LGA of Residence</label>
              <input name="lga_of_residence" value={form.lga_of_residence} onChange={handleChange} placeholder="e.g. Surulere" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State of Residence</label>
              <input name="state_of_residence" value={form.state_of_residence} onChange={handleChange} placeholder="e.g. Lagos" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Academic Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Academic Session <span className="text-red-500">*</span></label>
              <select name="session_id" value={form.session_id} onChange={handleChange} required className={inputClass}>
                <option value="">Select Session</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_current ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Admission Date</label>
              <input type="date" name="admission_date" value={form.admission_date} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Section <span className="text-red-500">*</span></label>
              <select name="section" value={form.section} onChange={handleChange} required className={inputClass}>
                <option value="">Select Section</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Class <span className="text-red-500">*</span></label>
              <select name="class_id" value={form.class_id} onChange={handleChange} required disabled={!form.section} className={inputClass}>
                <option value="">Select Class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {arms.length > 0 && (
              <div>
                <label className={labelClass}>Arm</label>
                <select name="arm_id" value={form.arm_id} onChange={handleChange} className={inputClass}>
                  <option value="">Select Arm</option>
                  {arms.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Guardian Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Guardian Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Guardian Full Name <span className="text-red-500">*</span></label>
              <input name="guardian_name" value={form.guardian_name} onChange={handleChange} required placeholder="Full name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Relationship <span className="text-red-500">*</span></label>
              <select name="guardian_relationship" value={form.guardian_relationship} onChange={handleChange} required className={inputClass}>
                <option value="">Select Relationship</option>
                {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Phone Number <span className="text-red-500">*</span></label>
              <input name="guardian_phone" value={form.guardian_phone} onChange={handleChange} required placeholder="e.g. 08012345678" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                Email Address
                <span className="text-xs text-gray-400 ml-1">(used to link parent account)</span>
              </label>
              <input type="email" name="guardian_email" value={form.guardian_email} onChange={handleChange} placeholder="parent@example.com" className={inputClass} />
            </div>
            {form.guardian_email && (
              <div>
                <label className={labelClass}>
                  Parent Temporary Password
                  <span className="text-xs text-gray-400 ml-1">(only used for a new account)</span>
                </label>
                <input
                  type="text"
                  value={guardianPassword}
                  onChange={(e) => setGuardianPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  If this email already has a parent account, this is ignored.
                </p>
              </div>
            )}
            <div>
              <label className={labelClass}>Occupation</label>
              <input name="guardian_occupation" value={form.guardian_occupation} onChange={handleChange} placeholder="e.g. Teacher, Engineer" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Medical Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            Medical Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Medical Conditions / Disabilities</label>
              <textarea name="medical_conditions" value={form.medical_conditions} onChange={handleChange} rows={2} placeholder="Any known medical conditions or disabilities" className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Name</label>
              <input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="Full name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Phone</label>
              <input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange} placeholder="e.g. 08012345678" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-light text-white font-semibold px-8 py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {saving ? 'Enrolling...' : 'Enroll Student'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/students')}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>

      </form>
      {/* Parent Credentials Modal */}
{parentCredentials && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <div className="text-center mb-5">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">✅</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800">
          Student Enrolled Successfully!
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {parentCredentials.linked
            ? 'Linked to an existing parent account.'
            : 'A parent account has been created.'}
        </p>
      </div>

      <div className="bg-blue-50 border border-primary/20 rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Parent Login Credentials
        </p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Parent Name:</span>
            <span className="font-semibold text-gray-800">
              {parentCredentials.name}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email:</span>
            <span className="font-semibold text-gray-800">
              {parentCredentials.email}
            </span>
          </div>
          {!parentCredentials.linked && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Temporary Password:</span>
              <span className="font-bold text-primary text-base">
                {parentCredentials.password}
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mb-5">
        {parentCredentials.linked
          ? 'This parent can log in with their existing password.'
          : 'Share these details with the parent now. The password is only shown once.'}
      </p>

      <button
        onClick={() => {
          setParentCredentials(null)
          navigate('/admin/students')
        }}
        className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-xl transition"
      >
        Done
      </button>
    </div>
  </div>
)}
    </AdminLayout>
  )
}

export default StudentForm