import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useTermStore } from '../../../store/termStore'
import { Save } from 'lucide-react'
import {
  savePendingGrades, getCachedStudents, getCachedSubjects,
  getCachedTeacherMeta, getCachedSchoolConfig,
  cacheTeacherMeta, cacheSchoolConfig,
} from '../../../lib/offlineDB'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'

const PHASES = [
  { key: 'ca1', label: 'CA 1' },
  { key: 'ca2', label: 'CA 2' },
  { key: 'exam', label: 'Exam' },
]

const EnterGrades = () => {
  const { user, schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const { checkPending } = useOnlineStatus()

  const [staffId, setStaffId] = useState(null)
  const [assignedClasses, setAssignedClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [scoreConfig, setScoreConfig] = useState({ max_ca1: 20, max_ca2: 20, max_exam: 60 })
  const [gradeScale, setGradeScale] = useState([])

  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [activePhase, setActivePhase] = useState('ca1')

  const [scores, setScores] = useState({})
  const [savedScores, setSavedScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  const inputRefs = useRef({})

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (navigator.onLine) {
        const { data: staffData } = await supabase
          .from('staff').select('id').eq('auth_user_id', user.id).single()
        if (!staffData) return
        setStaffId(staffData.id)

        const { data: classData } = await supabase
    .from('teacher_classes')
    .select('*, classes(id, name, section), arms(id, name)')
    .eq('staff_id', staffData.id)
        setAssignedClasses(classData || [])

        const { data: schoolData } = await supabase
          .from('schools').select('score_config, grade_scale').eq('id', schoolId).single()
        if (schoolData?.score_config) setScoreConfig(schoolData.score_config)
        if (schoolData?.grade_scale) setGradeScale(schoolData.grade_scale)
        if (schoolData) cacheSchoolConfig(schoolData.score_config, schoolData.grade_scale)
        if (classData?.length > 0) cacheTeacherMeta(staffData.id, classData)
      } else {
        const { staffId: cachedStaffId, assignedClasses: cachedClasses } = getCachedTeacherMeta()
        if (cachedStaffId) {
          setStaffId(cachedStaffId)
          setAssignedClasses(cachedClasses)
        }
        const { scoreConfig: cachedScoreConfig, gradeScale: cachedGradeScale } = getCachedSchoolConfig()
        if (cachedScoreConfig) setScoreConfig(cachedScoreConfig)
        if (cachedGradeScale) setGradeScale(cachedGradeScale)
      }
    }
    if (user && currentSession && schoolId) fetchData()
  }, [user, currentSession, schoolId])

  // Load subjects when class changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!selectedClass) return
      const section = selectedClass.classes.section
      if (navigator.onLine) {
        const { data } = await supabase
          .from('subjects')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .or(`section.eq.${section},section.eq.Both`)
          .order('name')
        setSubjects(data || [])
      } else {
        const cached = await getCachedSubjects()
        const filtered = cached
          .filter(s => s.section === section || s.section === 'Both')
          .sort((a, b) => a.name.localeCompare(b.name))
        setSubjects(filtered)
      }
      setSelectedSubject(null)
    }
    fetchSubjects()
  }, [selectedClass])

  // Load students & existing grades when class/subject/term changes
  useEffect(() => {
    const fetchStudentsAndGrades = async () => {
      if (!selectedClass || !selectedSubject || !currentTerm) return

      // Check if report card published (locked)
      const { data: reportCard } = await supabase
        .from('report_cards')
        .select('is_published')
        .eq('term_id', currentTerm.id)
        .eq('class_id', selectedClass.classes.id)
        .limit(1)
        .single()
      setLocked(reportCard?.is_published || false)

      // Fetch students
      let studentData
      if (navigator.onLine) {
        const query = supabase
          .from('students')
          .select('id, first_name, middle_name, last_name, admission_number')
          .eq('class_id', selectedClass.classes.id)
          .eq('status', 'Active')
          .order('first_name')
        if (selectedClass.arm_id) query.eq('arm_id', selectedClass.arm_id)
        const res = await query
        studentData = res.data || []
      } else {
        const cached = await getCachedStudents(selectedClass.classes.id)
        studentData = (selectedClass.arm_id
          ? cached.filter(s => s.arm_id === selectedClass.arm_id)
          : cached
        ).sort((a, b) => a.first_name.localeCompare(b.first_name))
      }
      setStudents(studentData)

      // Fetch existing grades (only possible online — offline starts blank,
      // same as a student with no prior score for this phase)
      let gradesData = null
      if (navigator.onLine) {
        const res = await supabase
          .from('grades')
          .select('*')
          .in('student_id', studentData.map(s => s.id))
          .eq('subject_id', selectedSubject.id)
          .eq('term_id', currentTerm.id)
        gradesData = res.data
      }

      // Map grades to scores
      const savedMap = {}
      gradesData?.forEach(g => {
        savedMap[g.student_id] = {
          ca1: g.ca1 ?? '',
          ca2: g.ca2 ?? '',
          exam_score: g.exam_score ?? '',
          total: g.total ?? 0,
          grade: g.grade ?? '',
          remark: g.remark ?? '',
        }
      })
      setSavedScores(savedMap)

      // Initialize editable scores from saved
      const scoreMap = {}
      studentData?.forEach(s => {
        scoreMap[s.id] = savedMap[s.id]?.[activePhase === 'exam' ? 'exam_score' : activePhase] ?? ''
      })
      setScores(scoreMap)
    }
    fetchStudentsAndGrades()
  }, [selectedClass, selectedSubject, currentTerm])

  // Reload score inputs when phase changes
  useEffect(() => {
    const scoreMap = {}
    students.forEach(s => {
      const field = activePhase === 'exam' ? 'exam_score' : activePhase
      scoreMap[s.id] = savedScores[s.id]?.[field] ?? ''
    })
    setScores(scoreMap)
  }, [activePhase, savedScores])

  const getGradeFromTotal = (total) => {
    const found = gradeScale.find(g => total >= g.min && total <= g.max)
    return found || { grade: 'F', remark: 'Poor' }
  }

  const getMaxForPhase = (phase) => {
    if (phase === 'ca1') return scoreConfig.max_ca1
    if (phase === 'ca2') return scoreConfig.max_ca2
    if (phase === 'exam') return scoreConfig.max_exam
    return 100
  }

  const getTotal = (studentId, currentPhaseScore) => {
    const saved = savedScores[studentId] || {}
    const ca1 = activePhase === 'ca1' ? Number(currentPhaseScore) || 0 : Number(saved.ca1) || 0
    const ca2 = activePhase === 'ca2' ? Number(currentPhaseScore) || 0 : Number(saved.ca2) || 0
    const exam = activePhase === 'exam' ? Number(currentPhaseScore) || 0 : Number(saved.exam_score) || 0
    return ca1 + ca2 + exam
  }

  const handleScoreChange = (studentId, value) => {
    const max = getMaxForPhase(activePhase)
    const clamped = Math.min(Number(value), max)
    setScores(prev => ({ ...prev, [studentId]: value === '' ? '' : clamped }))
  }

  // Enter key → move to next student
  const handleKeyDown = (e, studentId, index) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextStudent = students[index + 1]
      if (nextStudent) {
        inputRefs.current[nextStudent.id]?.focus()
      }
    }
  }

  const handleSave = async () => {
    if (!currentTerm || !currentSession || !selectedSubject || !selectedClass) {
      setError('Please select all required fields.')
      return
    }
    if (locked) {
      setError('Report card is published. Scores are locked.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const field = activePhase === 'exam' ? 'exam_score' : activePhase

      const records = students.map(student => {
        const saved = savedScores[student.id] || {}
        const newScore = scores[student.id] === '' ? 0 : Number(scores[student.id])

        const ca1 = activePhase === 'ca1' ? newScore : Number(saved.ca1) || 0
        const ca2 = activePhase === 'ca2' ? newScore : Number(saved.ca2) || 0
        const exam = activePhase === 'exam' ? newScore : Number(saved.exam_score) || 0
        const total = ca1 + ca2 + exam
        const { grade, remark } = getGradeFromTotal(total)

        return {
          student_id: student.id,
          subject_id: selectedSubject.id,
          class_id: selectedClass.classes.id,
          arm_id: selectedClass.arm_id || null,
          session_id: currentSession.id,
          term_id: currentTerm.id,
          ca1,
          ca2,
          exam_score: exam,
          grade,
          remark,
          entered_by: staffId,
        }
      })

      if (navigator.onLine) {
        const { error } = await supabase
          .from('grades')
          .upsert(records, { onConflict: 'student_id,subject_id,term_id' })

        if (error) throw error
      } else {
        await savePendingGrades(records)
        checkPending()
      }

      // Update savedScores
      const updatedSaved = { ...savedScores }
      students.forEach(student => {
        const saved = savedScores[student.id] || {}
        const newScore = scores[student.id] === '' ? 0 : Number(scores[student.id])
        updatedSaved[student.id] = {
          ...saved,
          [field]: newScore,
        }
      })
      setSavedScores(updatedSaved)

      setSuccess(
        navigator.onLine
          ? `${PHASES.find(p => p.key === activePhase)?.label} scores saved successfully!`
          : `📱 ${PHASES.find(p => p.key === activePhase)?.label} scores saved offline — will sync when connected`
      )
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save scores. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const maxScore = getMaxForPhase(activePhase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Enter Grades</h1>
        <p className="text-gray-500 text-sm mt-1">
          {currentSession?.name} — {currentTerm?.name || 'No active term'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}
      {locked && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
          🔒 Report card has been published. Scores are locked and cannot be edited.
        </div>
      )}

      {/* Selection Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={selectedSubject?.id || ''}
              onChange={(e) => {
                const found = subjects.find(s => s.id === e.target.value)
                setSelectedSubject(found || null)
              }}
              disabled={!selectedClass}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-50"
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
            <div className="flex gap-2">
              {PHASES.map(phase => (
                <button
                  key={phase.key}
                  onClick={() => setActivePhase(phase.key)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                    activePhase === phase.key
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {phase.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grades Table */}
      {selectedClass && selectedSubject && students.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Header info */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">
                {selectedSubject.name}
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                {PHASES.find(p => p.key === activePhase)?.label} — Max: {maxScore}
              </span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || locked}
              className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60 text-sm"
            >
              <Save size={15} />
              {saving ? 'Saving...' : 'Save Scores'}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    CA1 /{scoreConfig.max_ca1}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    CA2 /{scoreConfig.max_ca2}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Exam /{scoreConfig.max_exam}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student, index) => {
                  const saved = savedScores[student.id] || {}
                  const currentScore = scores[student.id] ?? ''
                  const total = getTotal(student.id, currentScore)
                  const { grade, remark } = getGradeFromTotal(total)

                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3 text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-800">
                          {student.first_name} {student.middle_name ? student.middle_name[0] + '. ' : ''}{student.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{student.admission_number}</p>
                      </td>

                      {/* CA1 */}
                      <td className="px-4 py-3 text-center">
                        {activePhase === 'ca1' && !locked ? (
                          <input
                            ref={el => inputRefs.current[student.id] = el}
                            type="number"
                            value={currentScore}
                            onChange={(e) => handleScoreChange(student.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id, index)}
                            min={0}
                            max={scoreConfig.max_ca1}
                            className="w-16 text-center px-2 py-1.5 border-2 border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                          />
                        ) : (
                          <span className={`text-sm font-medium ${saved.ca1 !== undefined && saved.ca1 !== '' ? 'text-gray-800' : 'text-gray-300'}`}>
                            {saved.ca1 !== undefined && saved.ca1 !== '' ? saved.ca1 : '—'}
                          </span>
                        )}
                      </td>

                      {/* CA2 */}
                      <td className="px-4 py-3 text-center">
                        {activePhase === 'ca2' && !locked ? (
                          <input
                            ref={el => inputRefs.current[student.id] = el}
                            type="number"
                            value={currentScore}
                            onChange={(e) => handleScoreChange(student.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id, index)}
                            min={0}
                            max={scoreConfig.max_ca2}
                            className="w-16 text-center px-2 py-1.5 border-2 border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                          />
                        ) : (
                          <span className={`text-sm font-medium ${saved.ca2 !== undefined && saved.ca2 !== '' ? 'text-gray-800' : 'text-gray-300'}`}>
                            {saved.ca2 !== undefined && saved.ca2 !== '' ? saved.ca2 : '—'}
                          </span>
                        )}
                      </td>

                      {/* Exam */}
                      <td className="px-4 py-3 text-center">
                        {activePhase === 'exam' && !locked ? (
                          <input
                            ref={el => inputRefs.current[student.id] = el}
                            type="number"
                            value={currentScore}
                            onChange={(e) => handleScoreChange(student.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id, index)}
                            min={0}
                            max={scoreConfig.max_exam}
                            className="w-16 text-center px-2 py-1.5 border-2 border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                          />
                        ) : (
                          <span className={`text-sm font-medium ${saved.exam_score !== undefined && saved.exam_score !== '' ? 'text-gray-800' : 'text-gray-300'}`}>
                            {saved.exam_score !== undefined && saved.exam_score !== '' ? saved.exam_score : '—'}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-primary">{total > 0 ? total : '—'}</span>
                      </td>

                      {/* Grade */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${
                          grade === 'A' ? 'text-green-600' :
                          grade === 'B' ? 'text-blue-600' :
                          grade === 'C' ? 'text-amber-600' :
                          grade === 'D' ? 'text-orange-500' :
                          'text-red-500'
                        }`}>
                          {total > 0 ? grade : '—'}
                        </span>
                      </td>

                      {/* Remark */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-500">{total > 0 ? remark : '—'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Save Button */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || locked}
              className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
            >
              <Save size={15} />
              {saving ? 'Saving...' : 'Save Scores'}
            </button>
          </div>
        </div>
      )}

      {selectedClass && selectedSubject && students.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          No active students found in this class.
        </div>
      )}
    </div>
  )
}

export default EnterGrades