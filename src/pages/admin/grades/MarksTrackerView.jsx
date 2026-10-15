import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useSections } from '../../hooks/useSections'
import { useDepartmentConfig } from '../../hooks/useDepartmentConfig'
import { attachDepartmentLinks, subjectFitsDepartment } from '../../lib/departmentUtils'
import { fetchAllRows } from '../../lib/feeUtils'
import { classModeOf } from '../../lib/teacherAssignments'

const PHASES = [
  { key: 'ca1', label: 'CA 1' },
  { key: 'ca2', label: 'CA 2' },
  { key: 'exam_score', label: 'Exam' },
]

const fullName = (staff) => (staff ? `${staff.first_name} ${staff.last_name}` : '')

// For one class and term: which subjects have marks entered, and who is responsible.
// mode "admin": Admin, Head Teacher or Principal (their own sections).
// mode "teacher": a Form Master or class teacher, for their own classes.
const MarksTrackerView = ({ mode }) => {
  const { schoolId, user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const { sectionNames, restricted, allSections, loading: sectionsLoading } = useSections()
  const { departmentSectionName, departmentMode } = useDepartmentConfig()

  const [options, setOptions] = useState([])
  const [loadedOptions, setLoadedOptions] = useState(false)
  const [selected, setSelected] = useState('')
  const [terms, setTerms] = useState([])
  const [termId, setTermId] = useState('')
  const [rows, setRows] = useState([])
  const [studentCount, setStudentCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // The classes this person can look at
  useEffect(() => {
    const loadOptions = async () => {
      if (!schoolId || sectionsLoading) return

      if (mode === 'teacher') {
        const { data: me } = await supabase
          .from('staff').select('id').eq('auth_user_id', user.id).maybeSingle()
        if (!me) { setOptions([]); setLoadedOptions(true); return }
        const { data } = await supabase
          .from('teacher_classes')
          .select('class_id, arm_id, classes(id, name, section), arms(id, name)')
          .eq('staff_id', me.id)
        setOptions((data || []).filter(r => r.classes).map(r => ({
          key: `${r.class_id}_${r.arm_id || ''}`,
          classId: r.class_id,
          armId: r.arm_id || null,
          section: r.classes.section,
          label: `${r.classes.name}${r.arms ? ' ' + r.arms.name : ''}`,
        })))
      } else {
        let query = supabase
          .from('classes')
          .select('id, name, section, has_arms, arms(id, name, is_active)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('section').order('name')
        if (restricted) query = query.in('section', sectionNames.length > 0 ? sectionNames : ['__none__'])
        const { data } = await query
        const list = []
        ;(data || []).forEach(c => {
          if (c.has_arms) {
            ;(c.arms || []).filter(a => a.is_active).forEach(a => list.push({
              key: `${c.id}_${a.id}`, classId: c.id, armId: a.id, section: c.section, label: `${c.name} ${a.name}`,
            }))
          } else {
            list.push({ key: `${c.id}_`, classId: c.id, armId: null, section: c.section, label: c.name })
          }
        })
        setOptions(list)
      }
      setLoadedOptions(true)
    }
    loadOptions()
  }, [schoolId, sectionsLoading, mode])

  // The terms of the current session, starting on the current term
  useEffect(() => {
    const loadTerms = async () => {
      if (!currentSession) return
      const { data } = await supabase
        .from('terms').select('id, name').eq('session_id', currentSession.id).order('start_date')
      setTerms(data || [])
      setTermId(currentTerm?.id || '')
    }
    loadTerms()
  }, [currentSession?.id, currentTerm?.id])

  useEffect(() => {
    const option = options.find(o => o.key === selected)
    if (!option || !termId) { setRows([]); setStudentCount(0); return }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        let studentQuery = supabase
          .from('students')
          .select('id, arm_id, department_id')
          .eq('class_id', option.classId)
          .eq('status', 'Active')
        if (option.armId) studentQuery = studentQuery.eq('arm_id', option.armId)
        const { data: students } = await studentQuery
        const studentList = students || []
        const studentIds = new Set(studentList.map(s => s.id))
        setStudentCount(studentList.length)

        const [subjectRes, gradeRows, classTeacherRes, subjectTeacherRes, armRes] = await Promise.all([
          supabase.from('subjects').select('id, name, section')
            .eq('school_id', schoolId).eq('is_active', true)
            .or(`section.is.null,section.eq."${option.section}"`)
            .order('name'),
          fetchAllRows(() =>
            supabase.from('grades')
              .select('student_id, subject_id, ca1, ca2, exam_score')
              .eq('class_id', option.classId).eq('term_id', termId).order('id')),
          supabase.from('teacher_classes')
            .select('arm_id, staff(first_name, last_name)')
            .eq('class_id', option.classId),
          supabase.from('teaching_assignments')
            .select('subject_id, arm_id, staff(first_name, last_name)')
            .eq('class_id', option.classId),
          supabase.from('arms').select('id, department_id').eq('class_id', option.classId),
        ])

        const subjects = await attachDepartmentLinks(subjectRes.data || [])

        const armDepartment = {}
        ;(armRes.data || []).forEach(a => { armDepartment[a.id] = a.department_id })
        const usesDepartments = !!departmentSectionName && option.section === departmentSectionName
        const departmentOf = (s) => (departmentMode === 'by_arm' ? armDepartment[s.arm_id] : s.department_id)

        const gradeMap = {}
        gradeRows.forEach(g => {
          if (studentIds.has(g.student_id)) gradeMap[`${g.student_id}|${g.subject_id}`] = g
        })

        const bySubject = classModeOf({ section: option.section }, allSections) === 'by_subject'
        const sameArm = (armId) => !armId || !option.armId || armId === option.armId
        const wholeClassTeachers = (classTeacherRes.data || [])
          .filter(t => sameArm(t.arm_id))
          .map(t => fullName(t.staff))
          .filter(Boolean)

        const list = []
        subjects.forEach(subject => {
          const expected = studentList.filter(s =>
            !usesDepartments || subjectFitsDepartment(subject, departmentOf(s))
          )
          if (expected.length === 0) return

          const counts = {}
          PHASES.forEach(p => {
            counts[p.key] = expected.filter(s =>
              Number(gradeMap[`${s.id}|${subject.id}`]?.[p.key]) > 0
            ).length
          })

          const everything = PHASES.every(p => counts[p.key] === expected.length)
          const nothing = PHASES.every(p => counts[p.key] === 0)

          const teachers = bySubject
            ? (subjectTeacherRes.data || [])
                .filter(t => t.subject_id === subject.id && sameArm(t.arm_id))
                .map(t => fullName(t.staff))
                .filter(Boolean)
            : wholeClassTeachers

          list.push({
            id: subject.id,
            name: subject.name,
            expected: expected.length,
            counts,
            teachers: [...new Set(teachers)],
            status: everything ? 'Complete' : nothing ? 'Not started' : 'In progress',
          })
        })
        setRows(list)
      } catch (err) {
        setError(`Could not load the tracker: ${err.message}`)
        setRows([])
      }
      setLoading(false)
    }
    load()
  }, [selected, termId, departmentSectionName, departmentMode])

  const complete = rows.filter(r => r.status === 'Complete').length
  const option = options.find(o => o.key === selected)
  const termName = terms.find(t => t.id === termId)?.name || ''

  const selectClass = "px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const cellClass = (done, total) =>
    total > 0 && done === total
      ? 'bg-green-50 text-green-700'
      : done > 0
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-50 text-gray-400'

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #tracker-print-area, #tracker-print-area * { visibility: visible; }
          #tracker-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Marks Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">
            See which subjects have marks entered for a class, and who is responsible for each.
          </p>
        </div>
        {rows.length > 0 && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium px-4 py-2.5 rounded-lg transition text-sm"
          >
            <Printer size={15} />
            Print
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {loadedOptions && options.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          {mode === 'teacher'
            ? 'You are not a Form Master or class teacher of any class yet.'
            : 'There are no classes to show.'}
        </div>
      )}

      {options.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={selectClass}>
            <option value="">Select class</option>
            {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <select value={termId} onChange={(e) => setTermId(e.target.value)} className={selectClass}>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {option && (
        <div id="tracker-print-area" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">Class</p>
              <p className="text-lg font-bold text-primary">{option.label}</p>
              <p className="text-xs text-gray-400">{termName}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">Students</p>
              <p className="text-2xl font-bold text-gray-700">{studentCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">Subjects complete</p>
              <p className={`text-2xl font-bold ${rows.length > 0 && complete === rows.length ? 'text-green-600' : 'text-amber-600'}`}>
                {complete} / {rows.length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</th>
                    {PHASES.map(p => (
                      <th key={p.key} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{p.label}</th>
                    ))}
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 animate-pulse">Loading...</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">No subjects found for this class.</td></tr>
                  )}
                  {!loading && rows.map(r => (
                    <tr key={r.id}>
                      <td className="px-6 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-6 py-3 text-gray-600 text-xs">
                        {r.teachers.length > 0
                          ? r.teachers.join(', ')
                          : <span className="text-red-500">Nobody assigned</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-500">{r.expected}</td>
                      {PHASES.map(p => (
                        <td key={p.key} className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${cellClass(r.counts[p.key], r.expected)}`}>
                            {r.counts[p.key]}/{r.expected}
                          </span>
                        </td>
                      ))}
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          r.status === 'Complete'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'In progress'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-600'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            A mark counts as entered when it is above zero, so a student who genuinely scored zero shows as not entered.
          </p>
        </div>
      )}
    </div>
  )
}

export default MarksTrackerView