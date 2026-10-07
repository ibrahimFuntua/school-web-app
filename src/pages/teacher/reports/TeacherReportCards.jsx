import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useTermStore } from '../../../store/termStore'
import { Save, Eye } from 'lucide-react'
import ReportCardView from '../../../components/shared/ReportCardView'

// ============================================================
// SOCIAL QUALITIES FORM COMPONENT
// ============================================================
const SocialQualitiesForm = ({ schoolId, classId, armId, termId }) => {
  const [traits, setTraits] = useState([])
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingId, setExistingId] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch traits
      const { data: traitData } = await supabase
        .from('quality_traits')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('order_number')

      setTraits(traitData || [])

      // Fetch existing scores
      const query = supabase
        .from('social_qualities')
        .select('*')
        .eq('class_id', classId)
        .eq('term_id', termId)

      if (armId) query.eq('arm_id', armId)
      else query.is('arm_id', null)

      const { data: existing } = await query.single()

      if (existing) {
        setExistingId(existing.id)
        setScores(existing.trait_scores || {})
      }
    }
    if (classId && termId && schoolId) fetchData()
  }, [classId, termId, armId, schoolId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        school_id: schoolId,
        class_id: classId,
        arm_id: armId || null,
        term_id: termId,
        trait_scores: scores,
        updated_at: new Date(),
      }

      if (existingId) {
        await supabase.from('social_qualities').update(payload).eq('id', existingId)
      } else {
        const { data } = await supabase
          .from('social_qualities').insert([payload]).select().single()
        setExistingId(data?.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const affective = traits.filter(t => t.category === 'affective')
  const psychomotor = traits.filter(t => t.category === 'psychomotor')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            Affective Traits & Psychomotor Skills
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Rate each trait 1-5 for all students in this class
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
        >
          <Save size={13} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          Saved! ✅
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Affective */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Affective Traits
          </h3>
          <div className="space-y-2">
            {affective.map(trait => (
              <div key={trait.id} className="flex items-center justify-between gap-3">
                <label className="text-sm text-gray-700 flex-1">{trait.name}</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setScores(prev => ({ ...prev, [trait.id]: n }))}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                        (scores[trait.id] || 0) >= n
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Psychomotor */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Psychomotor Skills
          </h3>
          <div className="space-y-2">
            {psychomotor.map(skill => (
              <div key={skill.id} className="flex items-center justify-between gap-3">
                <label className="text-sm text-gray-700 flex-1">{skill.name}</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setScores(prev => ({ ...prev, [skill.id]: n }))}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                        (scores[skill.id] || 0) >= n
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        1 = Very Poor · 2 = Poor · 3 = Fair · 4 = Good · 5 = Excellent
      </p>
    </div>
  )
}


const DEFAULT_RANGES = [
  { min: 75, max: 100, remark: 'Excellent performance, keep it up!' },
  { min: 60, max: 74, remark: 'Very good performance, try harder!' },
  { min: 50, max: 59, remark: 'Good performance, more effort needed.' },
  { min: 40, max: 49, remark: 'Fair performance, needs improvement.' },
  { min: 0,  max: 39, remark: 'Poor performance, must try harder.' },
]

const TeacherReportCards = () => {
  const { user, schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()

  const [staffId, setStaffId] = useState(null)
  const [assignedClasses, setAssignedClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [studentAverages, setStudentAverages] = useState({})
  const [ranges, setRanges] = useState(DEFAULT_RANGES)
  const [saving, setSaving] = useState(false)
  const [savingRanges, setSavingRanges] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [viewingStudent, setViewingStudent] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff').select('id').eq('auth_user_id', user.id).single()
      if (data) {
        setStaffId(data.id)
        const { data: classData } = await supabase
  .from('teacher_classes')
  .select('*, classes(id, name, section), arms(id, name)')
  .eq('staff_id', data.id)
        setAssignedClasses(classData || [])
        if (classData?.length === 1) setSelectedClass(classData[0])
      }
    }
    if (user && currentSession) fetchStaff()
  }, [user, currentSession])

  useEffect(() => {
    if (selectedClass && currentTerm) {
      fetchStudentsAndAverages()
      fetchExistingRanges()
    }
  }, [selectedClass, currentTerm])

  const fetchStudentsAndAverages = async () => {
    setLoading(true)
    const query = supabase
      .from('students')
      .select('id, first_name, middle_name, last_name, admission_number')
      .eq('class_id', selectedClass.classes.id)
      .eq('status', 'Active')
      .order('first_name')

    if (selectedClass.arm_id) query.eq('arm_id', selectedClass.arm_id)
    const { data: studentData } = await query
    setStudents(studentData || [])

    // Fetch grades for each student to calculate averages
    const { data: gradesData } = await supabase
      .from('grades')
      .select('student_id, total')
      .in('student_id', studentData?.map(s => s.id) || [])
      .eq('term_id', currentTerm.id)

    // Calculate average per student
    const averageMap = {}
    studentData?.forEach(student => {
      const studentGrades = gradesData?.filter(g => g.student_id === student.id) || []
      const total = studentGrades.reduce((sum, g) => sum + Number(g.total || 0), 0)
      const avg = studentGrades.length > 0 ? (total / studentGrades.length).toFixed(1) : 0
      averageMap[student.id] = Number(avg)
    })
    setStudentAverages(averageMap)
    setLoading(false)
  }

  const fetchExistingRanges = async () => {
    const { data } = await supabase
      .from('remark_ranges')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_id', selectedClass.classes.id)
      .eq('term_id', currentTerm.id)
      .eq('range_type', 'teacher')
      .order('min_score', { ascending: false })

    if (data && data.length > 0) {
      setRanges(data.map(r => ({
        id: r.id,
        min: r.min_score,
        max: r.max_score,
        remark: r.remark,
      })))
    } else {
      setRanges(DEFAULT_RANGES)
    }
  }

  const getRemarkForAverage = (average) => {
    const range = ranges.find(r => average >= r.min && average <= r.max)
    return range?.remark || '—'
  }

  const handleRangeChange = (index, field, value) => {
    const updated = [...ranges]
    updated[index] = { ...updated[index], [field]: value }
    setRanges(updated)
  }

  const handleSaveRanges = async () => {
    setSavingRanges(true)
    setError('')
    try {
      // Delete existing ranges for this class/term
      await supabase
        .from('remark_ranges')
        .delete()
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass.classes.id)
        .eq('term_id', currentTerm.id)
        .eq('range_type', 'teacher')

      // Insert new ranges
      const { error } = await supabase
        .from('remark_ranges')
        .insert(ranges.map(r => ({
          school_id: schoolId,
          class_id: selectedClass.classes.id,
          term_id: currentTerm.id,
          range_type: 'teacher',
          min_score: r.min,
          max_score: r.max,
          remark: r.remark,
        })))

      if (error) throw error
      setSuccess('Remark ranges saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save remark ranges.')
    } finally {
      setSavingRanges(false)
    }
  }

  const handleGenerateReportCards = async () => {
    if (!currentTerm || !currentSession) {
      setError('No active term set.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const records = students.map(student => {
        const avg = studentAverages[student.id] || 0
        const teacherRemark = getRemarkForAverage(avg)
        return {
          student_id: student.id,
          session_id: currentSession.id,
          term_id: currentTerm.id,
          class_id: selectedClass.classes.id,
          arm_id: selectedClass.arm_id || null,
          teacher_remark: teacherRemark,
          promotion_status: 'Promoted',
          is_published: false,
        }
      })

      const { error } = await supabase
        .from('report_cards')
        .upsert(records, { onConflict: 'student_id,term_id' })

      if (error) throw error
      setSuccess('Report cards generated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to generate report cards.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Report Cards</h1>
        <p className="text-gray-500 text-sm mt-1">
          Set remark ranges and generate report cards for your class.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Class Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
        <select
          value={selectedClass ? `${selectedClass.class_id}_${selectedClass.arm_id || ''}` : ''}
          onChange={(e) => {
            const [classId, armId] = e.target.value.split('_')
            const found = assignedClasses.find(c =>
              c.class_id === classId && (c.arm_id || '') === (armId || '')
            )
            setSelectedClass(found || null)
          }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="">Select Class</option>
          {assignedClasses.map(cls => (
            <option key={`${cls.class_id}_${cls.arm_id || ''}`} value={`${cls.class_id}_${cls.arm_id || ''}`}>
              {cls.classes?.name}{cls.arms?.name ? ` ${cls.arms.name}` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedClass && currentTerm && (
  <>
    {/* Social Qualities */}
    <SocialQualitiesForm
      schoolId={schoolId}
      classId={selectedClass.classes.id}
      armId={selectedClass.arm_id || null}
      termId={currentTerm.id}
    />

    {/* Remark Ranges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">
                  Remark Ranges
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Set the remark for each average score range
                </p>
              </div>
              <button
                onClick={handleSaveRanges}
                disabled={savingRanges}
                className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
              >
                <Save size={13} />
                {savingRanges ? 'Saving...' : 'Save Ranges'}
              </button>
            </div>

            <div className="space-y-3">
              {ranges.map((range, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={range.min}
                      onChange={(e) => handleRangeChange(index, 'min', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition text-center"
                      placeholder="Min"
                    />
                  </div>
                  <div className="col-span-1 text-center text-gray-400 text-sm">—</div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={range.max}
                      onChange={(e) => handleRangeChange(index, 'max', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition text-center"
                      placeholder="Max"
                    />
                  </div>
                  <div className="col-span-7">
                    <input
                      type="text"
                      value={range.remark}
                      onChange={(e) => handleRangeChange(index, 'remark', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                      placeholder="Remark text"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-12 gap-2 mt-1 px-1">
              <p className="col-span-2 text-xs text-gray-400 text-center">Min</p>
              <div className="col-span-1" />
              <p className="col-span-2 text-xs text-gray-400 text-center">Max</p>
              <p className="col-span-7 text-xs text-gray-400">Remark</p>
            </div>
          </div>

          {/* Students & Averages */}
          {loading ? (
            <p className="text-gray-400 animate-pulse">Loading students...</p>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">
                  Student Averages & Auto Remarks
                </h2>
                <button
                  onClick={handleGenerateReportCards}
                  disabled={saving}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60"
                >
                  <Save size={15} />
                  {saving ? 'Generating...' : 'Generate Report Cards'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Average</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Auto Remark</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-gray-400">
                          No students found.
                        </td>
                      </tr>
                    )}
                    {students.map((student, index) => {
                      const avg = studentAverages[student.id] || 0
                      const remark = getRemarkForAverage(avg)
                      return (
                        <tr key={student.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-3 text-gray-400 text-xs">{index + 1}</td>
                          <td className="px-6 py-3">
                            <p className="font-medium text-gray-800">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-xs text-gray-400">{student.admission_number}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-bold ${
                              avg >= 75 ? 'text-green-600' :
                              avg >= 60 ? 'text-blue-600' :
                              avg >= 50 ? 'text-amber-600' :
                              avg >= 40 ? 'text-orange-500' :
                              'text-red-500'
                            }`}>
                              {avg > 0 ? `${avg}%` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 italic">
                            {avg > 0 ? remark : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setViewingStudent(student)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                              title="View Report Card"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Report Card Modal */}
      {viewingStudent && currentTerm && (
        <ReportCardView
          studentId={viewingStudent.id}
          termId={currentTerm.id}
          sessionId={currentSession?.id}
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  )
}

export default TeacherReportCards