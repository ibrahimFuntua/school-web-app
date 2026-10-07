import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { GENDERS, SECTIONS, GUARDIAN_RELATIONSHIPS } from '../../../lib/constants'
import { ArrowLeft, Save } from 'lucide-react'

const StudentProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [classes, setClasses] = useState([])
  const [arms, setArms] = useState([])
  const [sessions, setSessions] = useState([])
  const [schoolId, setSchoolId] = useState(null)

  const [form, setForm] = useState(null)

  useEffect(() => {
    const fetchStudent = async () => {
      const { data } = await supabase
        .from('students')
        .select('*, classes(*, arms(*))')
        .eq('id', id)
        .single()

      if (data) {
        setSchoolId(data.school_id)
        setForm(data)

        // Load classes for section
        const { data: classData } = await supabase
          .from('classes')
          .select('*, arms(*)')
          .eq('school_id', data.school_id)
          .eq('section', data.section)
          .eq('is_active', true)
        setClasses(classData || [])

        const selected = classData?.find(c => c.id === data.class_id)
        setArms(selected?.arms?.filter(a => a.is_active) || [])

        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*')
          .eq('school_id', data.school_id)
          .order('created_at', { ascending: false })
        setSessions(sessionData || [])
      }
      setLoading(false)
    }
    fetchStudent()
  }, [id])

  useEffect(() => {
    if (!form?.section || !schoolId) return
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('*, arms(*)')
        .eq('school_id', schoolId)
        .eq('section', form.section)
        .eq('is_active', true)
      setClasses(data || [])
    }
    fetchClasses()
  }, [form?.section])

  useEffect(() => {
    const selected = classes.find(c => c.id === form?.class_id)
    setArms(selected?.arms?.filter(a => a.is_active) || [])
  }, [form?.class_id, classes])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { error } = await supabase
        .from('students')
        .update({
          first_name: form.first_name,
          middle_name: form.middle_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          state_of_origin: form.state_of_origin,
          lga_of_origin: form.lga_of_origin,
          nationality: form.nationality,
          religion: form.religion,
          blood_group: form.blood_group,
          genotype: form.genotype,
          home_address: form.home_address,
          lga_of_residence: form.lga_of_residence,
          state_of_residence: form.state_of_residence,
          section: form.section,
          class_id: form.class_id,
          arm_id: form.arm_id || null,
          session_id: form.session_id,
          admission_date: form.admission_date,
          status: form.status,
          guardian_name: form.guardian_name,
          guardian_relationship: form.guardian_relationship,
          guardian_phone: form.guardian_phone,
          guardian_email: form.guardian_email,
          guardian_occupation: form.guardian_occupation,
          medical_conditions: form.medical_conditions,
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
          updated_at: new Date(),
        })
        .eq('id', id)

      if (error) throw error
      setSuccess('Student information updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to update student information.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading student...</p>
    </AdminLayout>
  )

  if (!form) return (
    <AdminLayout>
      <p className="text-red-500">Student not found.</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/students')}
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {form.first_name} {form.last_name}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {form.admission_number} · {form.section} Section
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
            <div>
              <label className={labelClass}>Religion</label>
              <input name="religion" value={form.religion || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Blood Group</label>
              <select name="blood_group" value={form.blood_group || ''} onChange={handleChange} className={inputClass}>
                <option value="">Select</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Genotype</label>
              <select name="genotype" value={form.genotype || ''} onChange={handleChange} className={inputClass}>
                <option value="">Select</option>
                {['AA','AS','SS','AC','SC'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={form.status || ''} onChange={handleChange} className={inputClass}>
                {['Active','Promoted','Demoted','Withdrawn','Graduated'].map(s => (
                  <option key={s} value={s}>{s}</option>
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
              <textarea name="home_address" value={form.home_address || ''} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>LGA of Residence</label>
              <input name="lga_of_residence" value={form.lga_of_residence || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State of Residence</label>
              <input name="state_of_residence" value={form.state_of_residence || ''} onChange={handleChange} className={inputClass} />
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
              <label className={labelClass}>Admission Number</label>
              <input value={form.admission_number || ''} disabled className={`${inputClass} bg-gray-50 text-gray-400`} />
            </div>
            <div>
              <label className={labelClass}>Admission Date</label>
              <input type="date" name="admission_date" value={form.admission_date || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Session</label>
              <select name="session_id" value={form.session_id || ''} onChange={handleChange} className={inputClass}>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Section</label>
              <select name="section" value={form.section || ''} onChange={(e) => setForm({ ...form, section: e.target.value, class_id: '', arm_id: '' })} className={inputClass}>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Class</label>
              <select name="class_id" value={form.class_id || ''} onChange={(e) => setForm({ ...form, class_id: e.target.value, arm_id: '' })} className={inputClass}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {arms.length > 0 && (
              <div>
                <label className={labelClass}>Arm</label>
                <select name="arm_id" value={form.arm_id || ''} onChange={handleChange} className={inputClass}>
                  <option value="">Select Arm</option>
                  {arms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              <label className={labelClass}>Guardian Name</label>
              <input name="guardian_name" value={form.guardian_name || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Relationship</label>
              <select name="guardian_relationship" value={form.guardian_relationship || ''} onChange={handleChange} className={inputClass}>
                {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="guardian_phone" value={form.guardian_phone || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="guardian_email" value={form.guardian_email || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Occupation</label>
              <input name="guardian_occupation" value={form.guardian_occupation || ''} onChange={handleChange} className={inputClass} />
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
              <label className={labelClass}>Medical Conditions</label>
              <textarea name="medical_conditions" value={form.medical_conditions || ''} onChange={handleChange} rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Name</label>
              <input name="emergency_contact_name" value={form.emergency_contact_name || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Phone</label>
              <input name="emergency_contact_phone" value={form.emergency_contact_phone || ''} onChange={handleChange} className={inputClass} />
            </div>
          </div>
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
            onClick={() => navigate('/admin/students')}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>

      </form>
    </AdminLayout>
  )
}

export default StudentProfile