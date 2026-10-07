import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { Save, Eye, CheckCircle } from 'lucide-react'
import ReportCardView from '../../components/shared/ReportCardView'
import AdminLayout from '../../components/layout/AdminLayout'

const DEFAULT_HEAD_RANGES = [
  { min: 70, max: 100, remark: 'Excellent result. Promoted with Distinction.' },
  { min: 60, max: 69,  remark: 'Good result. Promoted to next class.' },
  { min: 50, max: 59,  remark: 'Satisfactory. Promoted to next class.' },
  { min: 40, max: 49,  remark: 'Fair result. Promoted on Probation.' },
  { min: 0,  max: 39,  remark: 'Poor result. Recommended to repeat class.' },
]

const HeadReportCards = ({ layout: Layout }) => {
  const { schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()

  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [studentAverages, setStudentAverages] = useState({})
  const [reportCards, setReportCards] = useState({})
  const [allClasses, setAllClasses] = useState([])
  const [ranges, setRanges] = useState(DEFAULT_HEAD_RANGES)
  const [savingRanges, setSavingRanges] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [overrides, setOverrides] = useState({})
  const [viewingStudent, setViewingStudent] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('*, arms(*)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('section').order('name')
      setClasses(data || [])
      setAllClasses(data || [])
    }
    if (schoolId) fetchClasses()
  }, [schoolId])

  useEffect(() => {
    if (selectedClass && currentTerm) {
      fetchStudentsData()
      fetchHeadRanges()
    }
  }, [selectedClass, currentTerm])

  const fetchStudentsData = async () => {
    setLoading(true)
    const { data: studentData } = await supabase
      .from('students')
      .select('id, first_name, middle_name, last_name, admission_number, class_id, arm_id')
      .eq('class_id', selectedClass.id)
      .eq('status', 'Active')
      .order('first_name')

    setStudents(studentData || [])

    // Grades & averages
    const { data: gradesData } = await supabase
      .from('grades')
      .select('student_id, total')
      .in('student_id', studentData?.map(s => s.id) || [])
      .eq('term_id', currentTerm.id)

    const averageMap = {}
    studentData?.forEach(student => {
      const studentGrades = gradesData?.filter(g => g.student_id === student.id) || []
      const total = studentGrades.reduce((sum, g) => sum + Number(g.total || 0), 0)
      const avg = studentGrades.length > 0 ? (total / studentGrades.length).toFixed(1) : 0
      averageMap[student.id] = Number(avg)
    })
    setStudentAverages(averageMap)

    // Existing report cards
    const { data: rcData } = await supabase
      .from('report_cards')
      .select('*')
      .in('student_id', studentData?.map(s => s.id) || [])
      .eq('term_id', currentTerm.id)

    const rcMap = {}
    rcData?.forEach(rc => { rcMap[rc.student_id] = rc })
    setReportCards(rcMap)

    // Initialize overrides from existing data
    const overrideMap = {}
    studentData?.forEach(s => {
      overrideMap[s.id] = {
        promotion_status: rcMap[s.id]?.promotion_status || 'Promoted',
      }
    })
    setOverrides(overrideMap)
    setLoading(false)
  }

  const fetchHeadRanges = async () => {
    const { data } = await supabase
      .from('remark_ranges')
      .select('*')
      .eq('school_id', schoolId)
      .eq('term_id', currentTerm.id)
      .eq('range_type', 'headmaster')
      .order('min_score', { ascending: false })

    if (data && data.length > 0) {
      setRanges(data.map(r => ({
        id: r.id,
        min: r.min_score,
        max: r.max_score,
        remark: r.remark,
      })))
    } else {
      setRanges(DEFAULT_HEAD_RANGES)
    }
  }

  const getHeadRemark = (average) => {
    const range = ranges.find(r => average >= r.min && average <= r.max)
    return range?.remark || '—'
  }

  const handleSaveRanges = async () => {
    setSavingRanges(true)
    setError('')
    try {
      await supabase
        .from('remark_ranges')
        .delete()
        .eq('school_id', schoolId)
        .eq('term_id', currentTerm.id)
        .eq('range_type', 'headmaster')

      const { error } = await supabase
        .from('remark_ranges')
        .insert(ranges.map(r => ({
          school_id: schoolId,
          class_id: selectedClass.id,
          term_id: currentTerm.id,
          range_type: 'headmaster',
          min_score: r.min,
          max_score: r.max,
          remark: r.remark,
        })))

      if (error) throw error
      setSuccess('Head teacher remark ranges saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save ranges.')
    } finally {
      setSavingRanges(false)
    }
  }

  const handleRangeChange = (index, field, value) => {
    const updated = [...ranges]
    updated[index] = { ...updated[index], [field]: value }
    setRanges(updated)
  }

  const handleOverrideChange = (studentId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }))
  }

  const handlePublishAll = async () => {
  setPublishing(true)
  setError('')
  try {
    // Get next class from class progression settings
    const { data: classOrderData } = await supabase
      .from('class_order')
      .select('next_class_id')
      .eq('class_id', selectedClass.id)
      .eq('school_id', schoolId)
      .single()

    const nextClassId = classOrderData?.next_class_id || null

    const records = students.map(student => {
      const avg = studentAverages[student.id] || 0
      const headRemark = getHeadRemark(avg)
      const override = overrides[student.id] || {}

      return {
        student_id: student.id,
        session_id: currentSession.id,
        term_id: currentTerm.id,
        class_id: selectedClass.id,
        arm_id: student.arm_id || null,
        head_remark: headRemark,
        promotion_status: override.promotion_status || 'Promoted',
        next_class_id: nextClassId,
        is_published: true,
        published_at: new Date().toISOString(),
      }
    })

    const { error } = await supabase
      .from('report_cards')
      .upsert(records, { onConflict: 'student_id,term_id' })

    if (error) throw error
    setSuccess(`Report cards published for ${selectedClass.name}!`)
    await fetchStudentsData()
    setTimeout(() => setSuccess(''), 3000)
  } catch (err) {
    setError('Failed to publish report cards.')
  } finally {
    setPublishing(false)
  }
}

  const publishedCount = Object.values(reportCards).filter(rc => rc.is_published).length

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Report Cards</h1>
        <p className="text-gray-500 text-sm mt-1">
          Review, add remarks and publish student report cards.
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
          value={selectedClass?.id || ''}
          onChange={(e) => {
            const found = classes.find(c => c.id === e.target.value)
            setSelectedClass(found || null)
          }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="">Select Class</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name} ({cls.section})</option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <>
          {/* Head Teacher Remark Ranges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">
                  Head Teacher Remark Ranges
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Applied to all classes this term
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
                    />
                  </div>
                  <div className="col-span-1 text-center text-gray-400 text-sm">—</div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={range.max}
                      onChange={(e) => handleRangeChange(index, 'max', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition text-center"
                    />
                  </div>
                  <div className="col-span-7">
                    <input
                      type="text"
                      value={range.remark}
                      onChange={(e) => handleRangeChange(index, 'remark', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-2 mt-1 px-1">
              <p className="col-span-2 text-xs text-gray-400 text-center">Min</p>
              <div className="col-span-1" />
              <p className="col-span-2 text-xs text-gray-400 text-center">Max</p>
              <p className="col-span-7 text-xs text-gray-400">Remark</p>
            </div>
          </div>

          {/* Students Table */}
          {loading ? (
            <p className="text-gray-400 animate-pulse">Loading students...</p>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">
                    {selectedClass.name} — Students
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {publishedCount} of {students.length} published
                  </p>
                </div>
                <button
                  onClick={handlePublishAll}
                  disabled={publishing || students.length === 0}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60"
                >
                  <CheckCircle size={15} />
                  {publishing ? 'Publishing...' : 'Publish All Report Cards'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Average</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Head Remark</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Promotion</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-400">
                          No students found.
                        </td>
                      </tr>
                    )}
                    {students.map((student, index) => {
                      const avg = studentAverages[student.id] || 0
                      const headRemark = getHeadRemark(avg)
                      const rc = reportCards[student.id]
                      const override = overrides[student.id] || {}

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
                          <td className="px-4 py-3 text-xs text-gray-600 italic max-w-xs">
                            {avg > 0 ? headRemark : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={override.promotion_status || 'Promoted'}
                              onChange={(e) => handleOverrideChange(student.id, 'promotion_status', e.target.value)}
                              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary transition"
                            >
                              <option value="Promoted">Promoted</option>
                              <option value="Demoted">Demoted</option>
                              <option value="Repeated">Repeated</option>
                              <option value="Withdrawn">Withdrawn</option>
                            </select>
                          </td>
                          
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              rc?.is_published
                                ? 'bg-green-50 text-green-700'
                                : 'bg-amber-50 text-amber-600'
                            }`}>
                              {rc?.is_published ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setViewingStudent(student)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
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
    </AdminLayout>
  )
}

export default HeadReportCards