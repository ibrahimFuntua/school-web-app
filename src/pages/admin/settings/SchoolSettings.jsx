import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useSections } from '../../../hooks/useSections'
import { getSectionReportSettings } from '../../../lib/reportSettings'
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
  const { sections } = useSections()
  const [departmentSectionId, setDepartmentSectionId] = useState('')
  const [departmentMode, setDepartmentMode] = useState('')
  const [savingDeptConfig, setSavingDeptConfig] = useState(false)
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
    section_settings: {},
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
        if (data.department_section_id) setDepartmentSectionId(data.department_section_id)
        if (data.department_mode) setDepartmentMode(data.department_mode)
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

  const updateSectionSetting = (sectionName, field, value) => {
    setReportSettings(prev => ({
      ...prev,
      section_settings: {
        ...(prev.section_settings || {}),
        [sectionName]: { ...getSectionReportSettings(prev, sectionName), [field]: value },
      },
    }))
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

  // Splits long ID lists into smaller groups so requests don't get too long
  const chunk = (arr, size = 100) => {
    const groups = []
    for (let i = 0; i < arr.length; i += size) groups.push(arr.slice(i, i + size))
    return groups
  }

  // Stops the whole reset if a step fails, instead of reporting success
  const check = ({ error }, label) => {
    if (error) throw new Error(`${label}: ${error.message}`)
  }

  // Gets every matching row, not just the first 1000
  const fetchAll = async (table, columns, column, value) => {
    let rows = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from(table).select(columns).eq(column, value).range(from, from + 999)
      if (error) throw new Error(`${table}: ${error.message}`)
      rows = rows.concat(data)
      if (data.length < 1000) break
      from += 1000
    }
    return rows
  }

  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // ---- Gather this school's IDs first ----
    const sessionIds = (await fetchAll('sessions', 'id', 'school_id', schoolId)).map(r => r.id)
    const classIds = (await fetchAll('classes', 'id', 'school_id', schoolId)).map(r => r.id)
    const staffRows = await fetchAll('staff', 'id, auth_user_id', 'school_id', schoolId)
    const staffIds = staffRows.map(r => r.id)
    const studentIds = (await fetchAll('students', 'id', 'school_id', schoolId)).map(r => r.id)

    // Parents linked to this school's students (parents have no school column)
    let candidateParentIds = []
    for (const ids of chunk(studentIds)) {
      const { data, error } = await supabase
        .from('parent_students').select('parent_id').in('student_id', ids)
      check({ error }, 'parent links')
      candidateParentIds.push(...(data || []).map(l => l.parent_id))
    }
    candidateParentIds = [...new Set(candidateParentIds)]

    // ---- Delete: children before parents ----
    for (const ids of chunk(studentIds)) {
      check(await supabase.from('attendance').delete().in('student_id', ids), 'attendance')
      check(await supabase.from('grades').delete().in('student_id', ids), 'grades')
      check(await supabase.from('report_cards').delete().in('student_id', ids), 'report cards')
      check(await supabase.from('parent_students').delete().in('student_id', ids), 'parent links')
    }

    check(await supabase.from('payments').delete().eq('school_id', schoolId), 'payments')
    check(await supabase.from('fees').delete().eq('school_id', schoolId), 'fees')
    check(await supabase.from('social_qualities').delete().eq('school_id', schoolId), 'social qualities')
    check(await supabase.from('remark_ranges').delete().eq('school_id', schoolId), 'remark ranges')
    check(await supabase.from('school_holidays').delete().eq('school_id', schoolId), 'holidays')
    check(await supabase.from('announcements').delete().eq('school_id', schoolId), 'announcements')

    for (const ids of chunk(staffIds)) {
      check(await supabase.from('teacher_classes').delete().in('staff_id', ids), 'teacher classes')
    }

    check(await supabase.from('students').delete().eq('school_id', schoolId), 'students')

    // Parents: remove only those left with no students anywhere.
    // A parent who also has a child at another school is kept untouched.
    const stillLinked = new Set()
    for (const ids of chunk(candidateParentIds)) {
      const { data, error } = await supabase
        .from('parent_students').select('parent_id').in('parent_id', ids)
      check({ error }, 'parent links')
      ;(data || []).forEach(l => stillLinked.add(l.parent_id))
    }
    const orphanParentIds = candidateParentIds.filter(id => !stillLinked.has(id))

    const orphanAuthIds = []
    for (const ids of chunk(orphanParentIds)) {
      const { data, error } = await supabase
        .from('parents').select('auth_user_id').in('id', ids)
      check({ error }, 'parents')
      ;(data || []).forEach(p => { if (p.auth_user_id) orphanAuthIds.push(p.auth_user_id) })
      check(await supabase.from('parents').delete().in('id', ids), 'parents')
    }

    check(await supabase.from('staff').delete().eq('school_id', schoolId), 'staff')

    for (const ids of chunk(classIds)) {
      check(await supabase.from('arms').delete().in('class_id', ids), 'arms')
    }
    check(await supabase.from('classes').delete().eq('school_id', schoolId), 'classes')
    check(await supabase.from('subjects').delete().eq('school_id', schoolId), 'subjects')

    for (const ids of chunk(sessionIds)) {
      check(await supabase.from('terms').delete().in('session_id', ids), 'terms')
    }
    check(await supabase.from('sessions').delete().eq('school_id', schoolId), 'sessions')

    check(await supabase.from('class_order').delete().eq('school_id', schoolId), 'class order')
    check(await supabase.from('quality_traits').delete().eq('school_id', schoolId), 'quality traits')

    // Reset school info to defaults
    check(await supabase.from('schools')
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
          section_settings: {},
        },
        updated_at: new Date(),
      })
      .eq('id', schoolId), 'school info')

    // ---- Remove the actual login accounts, role rows and number counters ----
    const authUserIdsToDelete = [
      ...staffRows.map(s => s.auth_user_id),
      ...orphanAuthIds,
    ].filter(uid => uid && uid !== currentUser.id)

    const { data: { session: authSession } } = await supabase.auth.getSession()
    const batches = chunk(authUserIdsToDelete, 50)
    if (batches.length === 0) batches.push([])

    for (let i = 0; i < batches.length; i++) {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/factory-reset-cleanup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            userIds: batches[i],
            schoolId,
            clearCounters: i === batches.length - 1,
          }),
        }
      )
      const result = await response.json()
      if (result.error) throw new Error(`Login cleanup: ${result.error}`)
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
    { key: 'departments', label: 'Departments' },
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
                        {/* One settings block per section this school has created */}
            {sections.length === 0 && (
              <p className="text-sm text-gray-400">
                No sections yet. Add your sections under Classes & Subjects, then Sections, and they will appear here.
              </p>
            )}
            {sections.map(s => {
              const sectionSettings = getSectionReportSettings(reportSettings, s.name)
              const options = [
                { field: 'use_position', title: 'Show Overall Position', hint: 'e.g. 1st out of 30' },
                { field: 'show_subject_position', title: 'Show Position in Each Subject', hint: 'e.g. 1st in Mathematics' },
                { field: 'use_grade', title: 'Show Grade', hint: 'Uses grading scale from Score Config' },
              ]
              return (
                <div key={s.id} className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3">
                      {s.name} Section
                    </h3>
                    <div className="space-y-3">
                      {options.map(opt => (
                        <label key={opt.field} className="flex items-center justify-between gap-3 cursor-pointer">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{opt.title}</p>
                            <p className="text-xs text-gray-400">{opt.hint}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!sectionSettings[opt.field]}
                            onChange={(e) => updateSectionSetting(s.name, opt.field, e.target.checked)}
                            className="w-5 h-5 accent-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-gray-100" />
                </div>
              )
            })}
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
      {activeTab === 'departments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg">
          <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100">
            Departments
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Departments (Science, Arts, Commercial, Technical) apply to one section only —
            usually your senior section. Set that up here, then manage the actual
            list of departments on the Departments page.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Which section uses departments?
              </label>
              <select
                value={departmentSectionId}
                onChange={(e) => setDepartmentSectionId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Not using departments</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {departmentSectionId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How are students grouped into departments?
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="department_mode"
                      checked={departmentMode === 'by_arm'}
                      onChange={() => setDepartmentMode('by_arm')}
                      className="mt-1 accent-primary"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">By Arm</span> — each department is its own class arm (e.g. "SS2 Science", "SS2 Arts")
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="department_mode"
                      checked={departmentMode === 'by_student'}
                      onChange={() => setDepartmentMode('by_student')}
                      className="mt-1 accent-primary"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">By Student</span> — students share one class/arm, department is tracked per student
                    </span>
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                setSavingDeptConfig(true)
                setError('')
                try {
                  const { error } = await supabase.from('schools').update({
                    department_section_id: departmentSectionId || null,
                    department_mode: departmentSectionId ? (departmentMode || null) : null,
                    updated_at: new Date(),
                  }).eq('id', schoolId)
                  if (error) throw error
                  setSuccess('Department settings saved!')
                  setTimeout(() => setSuccess(''), 3000)
                } catch (err) {
                  setError(err.message || 'Failed to save department settings.')
                } finally {
                  setSavingDeptConfig(false)
                }
              }}
              disabled={savingDeptConfig || (departmentSectionId && !departmentMode)}
              className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {savingDeptConfig ? 'Saving...' : 'Save'}
            </button>

            {departmentSectionId && departmentMode && (
              <a
                href="/admin/departments"
                className="block text-sm text-primary font-medium hover:underline pt-2"
              >
                → Manage {sections.find(s => s.id === departmentSectionId)?.name} departments
              </a>
            )}
          </div>
        </div>
      )}

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