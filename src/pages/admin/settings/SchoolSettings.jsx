import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Plus, Trash2, GripVertical } from 'lucide-react'

// ============================================================
// CLASS ORDER MANAGER
// ============================================================
const ClassOrderManager = ({ schoolId }) => {
  const [classes, setClasses] = useState([])
  const [classOrder, setClassOrder] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const [classRes, orderRes] = await Promise.all([
        supabase.from('classes').select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('section').order('name'),
        supabase.from('class_order').select('*')
          .eq('school_id', schoolId),
      ])
      setClasses(classRes.data || [])
      const orderMap = {}
      orderRes.data?.forEach(o => { orderMap[o.class_id] = o.next_class_id })
      setClassOrder(orderMap)
    }
    if (schoolId) fetchData()
  }, [schoolId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('class_order').delete().eq('school_id', schoolId)
      const records = Object.entries(classOrder)
        .filter(([, nextId]) => nextId)
        .map(([classId, nextClassId]) => ({
          school_id: schoolId,
          class_id: classId,
          next_class_id: nextClassId,
          order_number: 0,
        }))
      if (records.length > 0) {
        await supabase.from('class_order').insert(records)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          Class progression saved!
        </div>
      )}
      {classes.map(cls => (
        <div key={cls.id} className="flex items-center gap-3">
          <div className="w-32 text-sm font-medium text-gray-700 shrink-0">{cls.name}</div>
          <span className="text-gray-400 text-sm">→</span>
          <select
            value={classOrder[cls.id] || ''}
            onChange={(e) => setClassOrder(prev => ({
              ...prev,
              [cls.id]: e.target.value || null
            }))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            <option value="">No progression (Final class)</option>
            {classes.filter(c => c.id !== cls.id).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      ))}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-2 bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Progression'}
      </button>
    </div>
  )
}

// ============================================================
// QUALITY TRAITS MANAGER
// ============================================================
const QualityTraitsManager = ({ schoolId }) => {
  const [affective, setAffective] = useState([])
  const [psychomotor, setPsychomotor] = useState([])
  const [newAffective, setNewAffective] = useState('')
  const [newPsychomotor, setNewPsychomotor] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const DEFAULT_AFFECTIVE = [
    'Attentiveness', 'Attitude to School Work', 'Cooperation with Others',
    'Emotional Stability', 'Health', 'Leadership', 'Attendance',
    'Neatness', 'Perseverance', 'Politeness', 'Punctuality', 'Speaking / Writing'
  ]

  const DEFAULT_PSYCHOMOTOR = [
    'Drawing & Painting', 'Handling of Tools', 'Games',
    'Handwriting', 'Music', 'Verbal Fluency'
  ]

  useEffect(() => {
    fetchTraits()
  }, [schoolId])

  const fetchTraits = async () => {
    const { data } = await supabase
      .from('quality_traits')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('order_number')

    if (data && data.length > 0) {
      setAffective(data.filter(t => t.category === 'affective'))
      setPsychomotor(data.filter(t => t.category === 'psychomotor'))
    } else {
      // Insert defaults
      await insertDefaults()
    }
  }

  const insertDefaults = async () => {
    const affectiveRecords = DEFAULT_AFFECTIVE.map((name, i) => ({
      school_id: schoolId,
      name,
      category: 'affective',
      order_number: i,
    }))
    const psychomotorRecords = DEFAULT_PSYCHOMOTOR.map((name, i) => ({
      school_id: schoolId,
      name,
      category: 'psychomotor',
      order_number: i,
    }))

    await supabase.from('quality_traits').insert([...affectiveRecords, ...psychomotorRecords])
    await fetchTraits()
  }

  const handleAdd = async (category) => {
    const name = category === 'affective' ? newAffective : newPsychomotor
    if (!name.trim()) return

    const list = category === 'affective' ? affective : psychomotor
    const { data } = await supabase
      .from('quality_traits')
      .insert([{
        school_id: schoolId,
        name: name.trim(),
        category,
        order_number: list.length,
      }])
      .select()
      .single()

    if (data) {
      if (category === 'affective') {
        setAffective(prev => [...prev, data])
        setNewAffective('')
      } else {
        setPsychomotor(prev => [...prev, data])
        setNewPsychomotor('')
      }
    }
  }

  const handleDelete = async (id, category) => {
    await supabase.from('quality_traits').update({ is_active: false }).eq('id', id)
    if (category === 'affective') {
      setAffective(prev => prev.filter(t => t.id !== id))
    } else {
      setPsychomotor(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleRename = async (id, newName, category) => {
    await supabase.from('quality_traits').update({ name: newName }).eq('id', id)
    if (category === 'affective') {
      setAffective(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t))
    } else {
      setPsychomotor(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t))
    }
  }

  const TraitList = ({ traits, category }) => (
    <div className="space-y-2">
      {traits.map((trait, index) => (
        <div key={trait.id} className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300 shrink-0" />
          <span className="text-xs text-gray-400 w-5">{index + 1}</span>
          <input
            type="text"
            defaultValue={trait.name}
            onBlur={(e) => {
              if (e.target.value !== trait.name) {
                handleRename(trait.id, e.target.value, category)
              }
            }}
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
          <button
            onClick={() => handleDelete(trait.id, category)}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={category === 'affective' ? newAffective : newPsychomotor}
          onChange={(e) => category === 'affective'
            ? setNewAffective(e.target.value)
            : setNewPsychomotor(e.target.value)
          }
          onKeyDown={(e) => e.key === 'Enter' && handleAdd(category)}
          placeholder="Add new trait..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        />
        <button
          onClick={() => handleAdd(category)}
          className="flex items-center gap-1 bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-light transition"
        >
          <Plus size={13} />
          Add
        </button>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Affective Traits
        </h3>
        <TraitList traits={affective} category="affective" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Psychomotor Skills
        </h3>
        <TraitList traits={psychomotor} category="psychomotor" />
      </div>
    </div>
  )
}

// ============================================================
// MAIN SCHOOL SETTINGS COMPONENT
// ============================================================
const SchoolSettings = () => {
  const { schoolId, user } = useAuthStore()
  const logoInputRef = useRef()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)

  const [form, setForm] = useState({ name: '', address: '', motto: '' })

  const [scoreConfig, setScoreConfig] = useState({
    max_ca1: 20, max_ca2: 20, max_exam: 60,
  })

  const [gradeScale, setGradeScale] = useState([
    { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
    { min: 60, max: 69, grade: 'B', remark: 'Very Good' },
    { min: 50, max: 59, grade: 'C', remark: 'Good' },
    { min: 40, max: 49, grade: 'D', remark: 'Fair' },
    { min: 0,  max: 39, grade: 'F', remark: 'Poor' },
  ])
  const [passwordForm, setPasswordForm] = useState({
  newPassword: '',
  confirmPassword: '',
})
const [changingPassword, setChangingPassword] = useState(false)
const [passwordSuccess, setPasswordSuccess] = useState('')
const [passwordError, setPasswordError] = useState('')
const [resetStep, setResetStep] = useState(1)
const [resetCheck1, setResetCheck1] = useState(false)
const [resetCheck2, setResetCheck2] = useState(false)
const [resetting, setResetting] = useState(false)
const [resetSuccess, setResetSuccess] = useState(false)

  const [reportSettings, setReportSettings] = useState({
    nursery_use_position: false,
    primary_use_position: true,
    nursery_use_grade: true,
    primary_use_grade: true,
    show_psychomotor: true,
    show_affective: true,
    primary_show_subject_position: true,
    nursery_show_subject_position: false,
  })

  useEffect(() => {
    const fetchSchool = async () => {
      if (!schoolId) { setLoading(false); return }
      const { data } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single()

      if (data) {
        setForm({ name: data.name, address: data.address || '', motto: data.motto || '' })
        if (data.score_config) setScoreConfig(data.score_config)
        if (data.grade_scale) setGradeScale(data.grade_scale)
        if (data.report_settings) setReportSettings(prev => ({ ...prev, ...data.report_settings }))
        if (data.logo_url) setLogoPreview(data.logo_url)
      }
      setLoading(false)
    }
    fetchSchool()
  }, [schoolId])

  // Compress and upload logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingLogo(true)
    setError('')

    try {
      // Compress image using canvas
      const compressedBlob = await compressImage(file, 200, 200, 0.7)
      const fileName = `logos/${schoolId}_logo.jpg`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(fileName)

      // Save to schools table
      await supabase
        .from('schools')
        .update({ logo_url: publicUrl })
        .eq('id', schoolId)

      setLogoPreview(publicUrl)
      setSuccess('Logo uploaded successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(`Logo upload failed: ${err.message}`)
    } finally {
      setUploadingLogo(false)
    }
  }

  // Image compression function
  const compressImage = (file, maxWidth, maxHeight, quality) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Scale down maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)

        canvas.toBlob(resolve, 'image/jpeg', quality)
      }
      img.src = url
    })
  }

  const handleSaveGeneral = async (e) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      if (schoolId) {
        const { error } = await supabase
          .from('schools')
          .update({ ...form, updated_at: new Date() })
          .eq('id', schoolId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('schools')
          .insert([form])
          .select()
          .single()
        if (error) throw error
        await supabase
          .from('user_roles')
          .update({ school_id: data.id })
          .eq('auth_user_id', user.id)
      }
      setSuccess('School settings saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveScoreConfig = async (e) => {
    e.preventDefault()
    const total = Number(scoreConfig.max_ca1) + Number(scoreConfig.max_ca2) + Number(scoreConfig.max_exam)
    if (total !== 100) {
      setError(`Score components must add up to 100. Current total: ${total}`)
      return
    }
    setError(''); setSaving(true)
    try {
      const { error } = await supabase
        .from('schools')
        .update({ score_config: scoreConfig, grade_scale: gradeScale, updated_at: new Date() })
        .eq('id', schoolId)
      if (error) throw error
      setSuccess('Score configuration saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save score configuration.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReportSettings = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('schools')
        .update({ report_settings: reportSettings, updated_at: new Date() })
        .eq('id', schoolId)
      if (error) throw error
      setSuccess('Report card settings saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save report settings.')
    } finally {
      setSaving(false)
    }
  }
  const handleChangePassword = async (e) => {
  e.preventDefault()
  setPasswordError('')
  setPasswordSuccess('')

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    setPasswordError('Passwords do not match.')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    setPasswordError('Password must be at least 6 characters.')
    return
  }

  setChangingPassword(true)
  try {
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword
    })
    if (error) throw error
    setPasswordSuccess('Password changed successfully!')
    setPasswordForm({ newPassword: '', confirmPassword: '' })
    setTimeout(() => setPasswordSuccess(''), 4000)
  } catch (err) {
    setPasswordError(err.message || 'Failed to change password.')
  } finally {
    setChangingPassword(false)
  }
}

const handleFactoryReset = async () => {
  if (!resetCheck1 || !resetCheck2) {
  setError('Please check both confirmation boxes.')
  return
}

  setResetting(true)
  setError('')

  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // Get admin role info to restore later
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('auth_user_id', currentUser.id)
      .single()

    // ---- Gather this school's IDs up front ----
    // terms, parent_students, teacher_classes and arms don't have their own
    // school_id column — they're only reachable via sessions/students/staff/
    // classes. Without scoping through these IDs, deleting from those tables
    // affects every school on the platform, not just this one.
    const { data: schoolSessions } = await supabase.from('sessions').select('id').eq('school_id', schoolId)
    const sessionIds = schoolSessions?.map(s => s.id) || []

    const { data: schoolClasses } = await supabase.from('classes').select('id').eq('school_id', schoolId)
    const classIds = schoolClasses?.map(c => c.id) || []

    const { data: schoolStaff } = await supabase.from('staff').select('id, auth_user_id').eq('school_id', schoolId)
    const staffIds = schoolStaff?.map(s => s.id) || []

    const { data: schoolStudents } = await supabase.from('students').select('id').eq('school_id', schoolId)
    const studentIds = schoolStudents?.map(s => s.id) || []

    const { data: schoolParents } = await supabase.from('parents').select('id, auth_user_id').eq('school_id', schoolId)

    // Every login account tied to this school (except the admin doing the reset)
    const authUserIdsToDelete = [
      ...(schoolStaff?.map(s => s.auth_user_id).filter(Boolean) || []),
      ...(schoolParents?.map(p => p.auth_user_id).filter(Boolean) || []),
    ].filter(uid => uid !== currentUser.id)

    // ---- DELETE IN CORRECT ORDER (children before parents) ----

    // 1. Delete attendance
    await supabase.from('attendance')
      .delete().eq('school_id', schoolId)

    // 2. Delete grades
    await supabase.from('grades')
      .delete().eq('school_id', schoolId)

    // 3. Delete report cards
    await supabase.from('report_cards')
      .delete().eq('school_id', schoolId)

    // 4. Delete payments
    await supabase.from('payments')
      .delete().eq('school_id', schoolId)

    // 5. Delete fees
    await supabase.from('fees')
      .delete().eq('school_id', schoolId)

    // 6. Delete social qualities
    await supabase.from('social_qualities')
      .delete().eq('school_id', schoolId)

    // 7. Delete remark ranges
    await supabase.from('remark_ranges')
      .delete().eq('school_id', schoolId)

    // 8. Delete school holidays
    await supabase.from('school_holidays')
      .delete().eq('school_id', schoolId)

    // 9. Delete announcements
    await supabase.from('announcements')
      .delete().eq('school_id', schoolId)

    // 10. Delete parent_students links (scoped to this school's students)
    if (studentIds.length > 0) {
      await supabase.from('parent_students').delete().in('student_id', studentIds)
    }

    // 11. Delete teacher_classes (scoped to this school's staff)
    if (staffIds.length > 0) {
      await supabase.from('teacher_classes').delete().in('staff_id', staffIds)
    }

    // 12. Delete students
    await supabase.from('students')
      .delete().eq('school_id', schoolId)

    // 13. Delete parents (parents DOES have its own school_id — no subquery needed)
    await supabase.from('parents')
      .delete().eq('school_id', schoolId)

    // 14. Delete staff
    await supabase.from('staff')
      .delete().eq('school_id', schoolId)

    // 15. Delete arms (scoped to this school's classes)
    if (classIds.length > 0) {
      await supabase.from('arms').delete().in('class_id', classIds)
    }

    // 16. Delete classes
    await supabase.from('classes')
      .delete().eq('school_id', schoolId)

    // 17. Delete subjects
    await supabase.from('subjects')
      .delete().eq('school_id', schoolId)

    // 18. Delete terms (scoped to this school's sessions)
    if (sessionIds.length > 0) {
      await supabase.from('terms').delete().in('session_id', sessionIds)
    }

    // 19. Delete sessions
    await supabase.from('sessions')
      .delete().eq('school_id', schoolId)

    // 20. Delete class order
    await supabase.from('class_order')
      .delete().eq('school_id', schoolId)

    // 21. Delete quality traits
    await supabase.from('quality_traits')
      .delete().eq('school_id', schoolId)

    // 22. Delete counters
    await supabase.from('counters')
      .delete().eq('school_id', schoolId)

    // 23. Remove all user_roles EXCEPT admin
    await supabase.from('user_roles')
      .delete()
      .neq('auth_user_id', currentUser.id)

    // 24. Reset school info to defaults
    await supabase.from('schools')
      .update({
        name: 'My School',
        address: 'My School Address',
        motto: 'My Motto',
        logo_url: null,
        score_config: {
          max_ca1: 20,
          max_ca2: 20,
          max_exam: 60
        },
        grade_scale: [
          { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
          { min: 60, max: 69,  grade: 'B', remark: 'Very Good' },
          { min: 50, max: 59,  grade: 'C', remark: 'Good' },
          { min: 40, max: 49,  grade: 'D', remark: 'Fair' },
          { min: 0,  max: 39,  grade: 'F', remark: 'Poor' },
        ],
        report_settings: {
          nursery_use_position: false,
          primary_use_position: true,
          nursery_use_grade: true,
          primary_use_grade: true,
          show_psychomotor: true,
          show_affective: true,
          primary_show_subject_position: true,
          nursery_show_subject_position: false,
        },
        updated_at: new Date(),
      })
      .eq('id', schoolId)

    // 25. Restore admin role — PRESERVE admin account
    await supabase.from('user_roles')
      .upsert({
        auth_user_id: currentUser.id,
        role: 'Admin',
        school_id: schoolId,
      }, { onConflict: 'auth_user_id' })

    // 26. Delete the actual login accounts for this school's staff/parents —
    // without this, their emails stay locked in auth.users forever
    if (authUserIdsToDelete.length > 0) {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-auth-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ userIds: authUserIdsToDelete, schoolId }),
      })
    }

    setResetSuccess(true)
    setResetting(false)

  } catch (err) {
    console.error('Reset error:', err)
    setError(`Reset failed: ${err.message}`)
    setResetting(false)
  }
}

  const handleGradeChange = (index, field, value) => {
    const updated = [...gradeScale]
    updated[index] = { ...updated[index], [field]: value }
    setGradeScale(updated)
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading settings...</p>
    </AdminLayout>
  )

  const tabs = [
    { key: 'general', label: 'General Info' },
    { key: 'scores', label: 'Score Config' },
    { key: 'reportcard', label: 'Report Card' },
    { key: 'traits', label: 'Qualities & Skills' },
    { key: 'classorder', label: 'Class Progression' },
    { key: 'password', label: 'Change Password' },
    { key: 'reset', label: '⚠️ Factory Reset' },
  ]

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">School Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure all school settings and report card options.
        </p>
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- GENERAL TAB ---- */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-2xl">
          {/* Logo Upload */}
          <div className="mb-6 pb-6 border-b border-gray-100">
            <label className={labelClass}>School Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-2">No Logo</span>
                )}
              </div>
              <div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="bg-primary hover:bg-primary-light text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                >
                  {uploadingLogo ? 'Uploading...' : logoPreview ? 'Change Logo' : 'Upload Logo'}
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  PNG or JPG. Will be compressed automatically.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveGeneral} className="space-y-5">
            <div>
              <label className={labelClass}>School Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. NCC Nursery & Primary School"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>School Address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={3}
                placeholder="e.g. 12 School Road, Lagos State"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className={labelClass}>School Motto</label>
              <input
                type="text"
                value={form.motto}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
                placeholder="e.g. Excellence in Learning"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ---- SCORE CONFIG TAB ---- */}
      {activeTab === 'scores' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
              Score Components
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Maximum scores must add up to exactly 100.
            </p>
            <form onSubmit={handleSaveScoreConfig} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Max CA1</label>
                  <input type="number" value={scoreConfig.max_ca1}
                    onChange={(e) => setScoreConfig({ ...scoreConfig, max_ca1: Number(e.target.value) })}
                    min={1} max={100} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Max CA2</label>
                  <input type="number" value={scoreConfig.max_ca2}
                    onChange={(e) => setScoreConfig({ ...scoreConfig, max_ca2: Number(e.target.value) })}
                    min={1} max={100} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Max Exam</label>
                  <input type="number" value={scoreConfig.max_exam}
                    onChange={(e) => setScoreConfig({ ...scoreConfig, max_exam: Number(e.target.value) })}
                    min={1} max={100} className={inputClass} />
                </div>
              </div>
              <div className={`text-sm font-medium px-4 py-2 rounded-lg ${
                Number(scoreConfig.max_ca1) + Number(scoreConfig.max_ca2) + Number(scoreConfig.max_exam) === 100
                  ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                Total: {Number(scoreConfig.max_ca1) + Number(scoreConfig.max_ca2) + Number(scoreConfig.max_exam)} / 100
              </div>
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Grading Scale</h3>
                <div className="space-y-2">
                  {gradeScale.map((row, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 items-center">
                      <input type="number" value={row.min}
                        onChange={(e) => handleGradeChange(index, 'min', Number(e.target.value))}
                        placeholder="Min"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                      <input type="number" value={row.max}
                        onChange={(e) => handleGradeChange(index, 'max', Number(e.target.value))}
                        placeholder="Max"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                      <input type="text" value={row.grade}
                        onChange={(e) => handleGradeChange(index, 'grade', e.target.value)}
                        placeholder="Grade"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                      <input type="text" value={row.remark}
                        onChange={(e) => handleGradeChange(index, 'remark', e.target.value)}
                        placeholder="Remark"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1 px-1">
                  <p className="text-xs text-gray-400">Min</p>
                  <p className="text-xs text-gray-400">Max</p>
                  <p className="text-xs text-gray-400">Grade</p>
                  <p className="text-xs text-gray-400">Remark</p>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Score Configuration'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---- REPORT CARD TAB ---- */}
      {activeTab === 'reportcard' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
            Report Card Settings
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Configure how report cards are displayed per section.
          </p>

          <div className="space-y-6">
            {/* Nursery Settings */}
            <div>
              <h3 className="text-sm font-semibold text-primary mb-3">
                🟣 Nursery Section
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Overall Position</p>
                    <p className="text-xs text-gray-400">e.g. 1st out of 30</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.nursery_use_position}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, nursery_use_position: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Position in Each Subject</p>
                    <p className="text-xs text-gray-400">e.g. 1st in Mathematics</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.nursery_show_subject_position}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, nursery_show_subject_position: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Grade</p>
                    <p className="text-xs text-gray-400">Uses grading scale from Score Config</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.nursery_use_grade}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, nursery_use_grade: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Primary Settings */}
            <div>
              <h3 className="text-sm font-semibold text-primary mb-3">
                🔵 Primary Section
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Overall Position</p>
                    <p className="text-xs text-gray-400">e.g. 1st out of 30</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.primary_use_position}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, primary_use_position: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Position in Each Subject</p>
                    <p className="text-xs text-gray-400">e.g. 1st in Mathematics</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.primary_show_subject_position}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, primary_show_subject_position: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Grade</p>
                    <p className="text-xs text-gray-400">Uses grading scale from Score Config</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.primary_use_grade}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, primary_use_grade: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Global Settings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                ⚙️ All Sections
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Affective Traits</p>
                    <p className="text-xs text-gray-400">Personal & social qualities section</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.show_affective}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, show_affective: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show Psychomotor Skills</p>
                    <p className="text-xs text-gray-400">Physical & practical skills section</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportSettings.show_psychomotor}
                    onChange={(e) => setReportSettings(prev => ({
                      ...prev, show_psychomotor: e.target.checked
                    }))}
                    className="w-5 h-5 accent-primary"
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveReportSettings}
            disabled={saving}
            className="mt-6 bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Report Settings'}
          </button>
        </div>
      )}

      {/* ---- TRAITS TAB ---- */}
      {activeTab === 'traits' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Affective Traits & Psychomotor Skills
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Add, edit or remove traits and skills that appear on the report card.
            Click on any name to rename it.
          </p>
          <QualityTraitsManager schoolId={schoolId} />
        </div>
      )}

      {/* ---- CLASS ORDER TAB ---- */}
      {activeTab === 'classorder' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Class Progression Order
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Set what class each class promotes to at end of session.
          </p>
          <ClassOrderManager schoolId={schoolId} />
        </div>
      )}
      {/* ---- PASSWORD TAB ---- */}
      {activeTab === 'password' && (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-md">
    <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
      Change Password
    </h2>
    <p className="text-xs text-gray-400 mb-5">
      Update your login password.
    </p>

    {passwordSuccess && (
      <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
        {passwordSuccess}
      </div>
    )}
    {passwordError && (
      <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
        {passwordError}
      </div>
    )}

    <form onSubmit={handleChangePassword} className="space-y-4">
      <div>
        <label className={labelClass}>
          New Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={passwordForm.newPassword}
          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
          required
          placeholder="Enter new password"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={passwordForm.confirmPassword}
          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
          required
          placeholder="Confirm new password"
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={changingPassword}
        className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
      >
        {changingPassword ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  </div>
      )}

      {/* ---Reset Password*/}
      {/* ---- FACTORY RESET TAB ---- */}
{activeTab === 'reset' && (
  <div className="max-w-lg">
    {!resetSuccess ? (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-red-700 mb-1">
              Factory Reset — Danger Zone
            </h2>
            <p className="text-xs text-red-600">
              This will permanently delete ALL data including students, staff,
              fees, attendance, grades, report cards, and announcements.
            </p>
          </div>
        </div>

        {resetStep === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 border border-red-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                What will be deleted:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                {[
                  'All students & enrollment records',
                  'All staff records & logins',
                  'All parent accounts',
                  'All fee structures & payment history',
                  'All attendance records',
                  'All grades & report cards',
                  'All sessions, terms & classes',
                  'All announcements',
                  'School logo & settings (reset to default)',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-red-400">✕</span>
                    {item}
                  </li>
                ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-green-700">
                What will be preserved:
              </p>
              <ul className="text-xs text-green-600 space-y-1 mt-1">
                <li className="flex items-center gap-2">
                  <span>✓</span> Your admin login credentials
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span> Your admin account access
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setResetStep(2)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition mt-4"
          >
            I understand, continue →
          </button>
        </div>
        )}

        {resetStep === 2 && (
  <div className="space-y-4">
    <div className="bg-white rounded-xl p-4 border border-red-200">
      <p className="text-sm font-semibold text-red-700 mb-3">
        Final Confirmation
      </p>
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={resetCheck1}
            onChange={(e) => setResetCheck1(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-red-600"
          />
          <span className="text-xs text-gray-700">
            I understand that ALL student, staff, parent, fee,
            attendance, grade and report card records will be
            permanently deleted.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={resetCheck2}
            onChange={(e) => setResetCheck2(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-red-600"
          />
          <span className="text-xs text-gray-700">
            I understand this action cannot be undone and I want
            to proceed with the factory reset.
          </span>
        </label>
      </div>
    </div>

    {error && (
      <div className="bg-red-100 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    )}

    <div className="flex gap-3">
      <button
        onClick={handleFactoryReset}
        disabled={resetting || !resetCheck1 || !resetCheck2}
        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {resetting ? '🔄 Resetting...' : '🗑️ Reset Everything'}
      </button>
      <button
        onClick={() => {
          setResetStep(1)
          setResetCheck1(false)
          setResetCheck2(false)
          setError('')
        }}
        className="px-5 py-2.5 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition"
      >
        Cancel
      </button>
    </div>
  </div>
)}
      </div>
    ) : (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="font-bold text-green-700 text-lg mb-2">
          Reset Complete!
        </h2>
        <p className="text-sm text-green-600 mb-5">
          All data has been cleared. The system is ready for a fresh start.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-light transition"
        >
          Reload App
        </button>
      </div>
    )}
  </div>
)}
      

    </AdminLayout>
  )
}

export default SchoolSettings