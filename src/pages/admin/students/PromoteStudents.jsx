import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useSections } from '../../../hooks/useSections'
import { useDepartmentConfig } from '../../../hooks/useDepartmentConfig'
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

const PromoteStudents = () => {
  const { schoolId } = useAuthStore()
  const { sectionNames, restricted, allSections } = useSections()
  const { departmentSectionName, departmentMode, departments } = useDepartmentConfig()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [classGroups, setClassGroups] = useState([])
  const [classOrder, setClassOrder] = useState({})
  const [classNames, setClassNames] = useState({})
  const [classSections, setClassSections] = useState({})
  const [allArms, setAllArms] = useState([])
  const [deptChoice, setDeptChoice] = useState({})
  const [overrides, setOverrides] = useState({})
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [promoted, setPromoted] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const [sessionsRes, classOrderRes, classesRes, armsRes] = await Promise.all([
        supabase.from('sessions').select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase.from('class_order').select('*')
          .eq('school_id', schoolId),
        supabase.from('classes').select('id, name, section')
          .eq('school_id', schoolId),
        supabase.from('arms').select('id, class_id, name'),
      ])

      setSessions(sessionsRes.data || [])

      const orderMap = {}
      classOrderRes.data?.forEach(o => {
        orderMap[o.class_id] = o.next_class_id
      })
      setClassOrder(orderMap)

      const nameMap = {}
      const sectionMap = {}
      classesRes.data?.forEach(c => { nameMap[c.id] = c.name; sectionMap[c.id] = c.section })
      setClassNames(nameMap)
      setClassSections(sectionMap)
      setAllArms(armsRes.data || [])
    }
    if (schoolId) fetchData()
  }, [schoolId])

  useEffect(() => {
    if (selectedSession) fetchStudents()
  }, [selectedSession])

  const fetchStudents = async () => {
    setLoading(true)
    setPromoted(false)
    setOverrides({})

    // Get all active students for this session
    let studentQuery = supabase
      .from('students')
      .select('*, classes(id, name, section), arms(name)')
      .eq('school_id', schoolId)
      .eq('session_id', selectedSession.id)
      .eq('status', 'Active')
      .order('first_name')
    // A Head Teacher / Principal only promotes students of the sections they manage
    if (restricted) studentQuery = studentQuery.in('section', sectionNames.length > 0 ? sectionNames : ['__none__'])
    const { data: students } = await studentQuery

    // Group students by class
    const groups = {}
    students?.forEach(student => {
      const classId = student.class_id
      if (!groups[classId]) {
        groups[classId] = {
          class: student.classes,
          students: [],
        }
      }
      groups[classId].students.push(student)
    })

    setClassGroups(Object.entries(groups).map(([classId, group]) => ({
      classId,
      ...group,
    })))

    // Initialize overrides - all Promoted by default
    const overrideMap = {}
    students?.forEach(s => {
      overrideMap[s.id] = 'Promoted'
    })
    setOverrides(overrideMap)

    // Start each student's department choice from the one they already have
    const deptMap = {}
    students?.forEach(s => { deptMap[s.id] = s.department_id || '' })
    setDeptChoice(deptMap)

    setLoading(false)
  }

  // Give a whole class the same department in one go
  const bulkDepartment = (group, departmentId) => {
    setDeptChoice(prev => {
      const next = { ...prev }
      group.students.forEach(s => { next[s.id] = departmentId })
      return next
    })
  }

  const handleOverride = (studentId, status) => {
    setOverrides(prev => ({ ...prev, [studentId]: status }))
  }

  const handlePromoteAll = async () => {
    if (!selectedSession) return
    setPromoting(true)
    setError('')

    try {
      // Get next session or create prompt
      const updates = []

      Object.entries(overrides).forEach(([studentId, status]) => {
        // Find student's current class
        let studentClass = null
        classGroups.forEach(group => {
          const found = group.students.find(s => s.id === studentId)
          if (found) studentClass = found
        })

        if (!studentClass) return

        const nextClassId = classOrder[studentClass.class_id]
        const isGraduating = !nextClassId && status === 'Promoted'

        const movingUp = status === 'Promoted' && !!nextClassId
        const currentSection = classSections[studentClass.class_id] || studentClass.classes?.section
        // The student's section follows the class they move into
        const newSection = movingUp ? (classSections[nextClassId] || currentSection) : currentSection

        // Keep the same arm name in the next class when there is one (A stays A), otherwise no arm
        const nextArm = movingUp
          ? allArms.find(a => a.class_id === nextClassId && a.name === studentClass.arms?.name)
          : null

        // Department: chosen here if the next class is in the department section, cleared otherwise
        let departmentId = studentClass.department_id || null
        if (movingUp) {
          departmentId = (departmentMode === 'by_student' && newSection === departmentSectionName)
            ? (deptChoice[studentId] || null)
            : null
        }

        updates.push({
          id: studentId,
          status: isGraduating ? 'Graduated' : status,
          class_id: movingUp ? nextClassId : studentClass.class_id,
          arm_id: movingUp ? (nextArm?.id || null) : studentClass.arm_id,
          section: newSection,
          department_id: departmentId,
        })
      })

      // Execute all updates, tracking any that fail instead of assuming success
      const failed = []
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('students')
          .update({
            status: update.status,
            class_id: update.class_id,
            arm_id: update.arm_id,
            section: update.section,
            department_id: update.department_id,
            updated_at: new Date(),
          })
          .eq('id', update.id)
        if (updateError) failed.push(update.id)
      }

      setPromoted(true)
      if (failed.length > 0) {
        setError(`${failed.length} of ${updates.length} students could not be updated. Please retry this batch.`)
      } else {
        setSuccess(`Successfully processed ${updates.length} students!`)
        setTimeout(() => setSuccess(''), 5000)
      }
    } catch (err) {
      setError('Failed to promote students. Please try again.')
    } finally {
      setPromoting(false)
    }
  }

  const totalStudents = classGroups.reduce((s, g) => s + g.students.length, 0)
  const totalPromoted = Object.values(overrides).filter(s => s === 'Promoted').length
  const totalDemoted = Object.values(overrides).filter(s => s === 'Demoted').length
  const totalWithdrawn = Object.values(overrides).filter(s => s === 'Withdrawn').length

  // Students about to enter the department section without a department chosen
  const withoutDepartment = departmentMode === 'by_student'
    ? classGroups.reduce((sum, g) => {
        const nextClassId = classOrder[g.classId]
        if (!nextClassId || classSections[nextClassId] !== departmentSectionName) return sum
        return sum + g.students.filter(s => overrides[s.id] === 'Promoted' && !deptChoice[s.id]).length
      }, 0)
    : 0

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Student Promotion</h1>
        <p className="text-gray-500 text-sm mt-1">
          Promote students to the next class at the end of a session.
        </p>
      </div>

      {success && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} />
          {success}
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Warning */}
      <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-700">Important</p>
          <p className="text-xs text-amber-600 mt-0.5">
            This action promotes all active students to their next class.
            Make sure all report cards are published before promoting.
            This should only be done at the end of the 3rd term. A student who moves into a class of another section also changes section, and so who manages them. Students keep the same arm name in the next class (A stays A) when it exists.
          </p>
        </div>
      </div>

      {/* Session Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Session to Promote From
        </label>
        <select
          value={selectedSession?.id || ''}
          onChange={(e) => {
            const found = sessions.find(s => s.id === e.target.value)
            setSelectedSession(found || null)
          }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="">Select Session</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} {s.is_current ? '(Current)' : ''}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-gray-400 animate-pulse">Loading students...</p>
      )}

      {!loading && classGroups.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400">Total Students</p>
              <p className="text-2xl font-bold text-primary">{totalStudents}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400">To Promote</p>
              <p className="text-2xl font-bold text-green-600">{totalPromoted}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400">To Demote</p>
              <p className="text-2xl font-bold text-amber-600">{totalDemoted}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400">Withdrawn</p>
              <p className="text-2xl font-bold text-red-500">{totalWithdrawn}</p>
            </div>
          </div>

          {/* Class Groups */}
          <div className="space-y-4 mb-6">
            {classGroups.map(group => {
              const nextClassId = classOrder[group.classId]
              const nextClassName = nextClassId
                ? classNames[nextClassId]
                : 'Graduating (No next class)'
              const nextSection = nextClassId ? classSections[nextClassId] : null
              const sectionChanges = !!nextSection && nextSection !== group.class?.section
              const nextManager = allSections.find(s => s.name === nextSection)?.managed_by
              const needsDepartment = !!nextSection && nextSection === departmentSectionName && departmentMode === 'by_student'

              return (
                <div
                  key={group.classId}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Class Header */}
                  <div
                    className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(prev => ({
                      ...prev,
                      [group.classId]: !prev[group.classId]
                    }))}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">
                        {group.class?.name}
                      </span>
                      <span className="text-xs bg-blue-50 text-primary px-2 py-0.5 rounded-full">
                        {group.students.length} students
                      </span>
                      <span className="text-xs text-gray-400">
                        → {nextClassName}
                      </span>
                      {sectionChanges && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          Moves to {nextSection}{nextManager ? ` · managed by ${nextManager}` : ''}
                        </span>
                      )}
                      {!nextClassId && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                          Final Class
                        </span>
                      )}
                    </div>
                    {expanded[group.classId]
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />
                    }
                  </div>

                  {/* Students List */}
                  {expanded[group.classId] && (
                    <div className="border-t border-gray-100">
                      {needsDepartment && (
                        <div className="px-6 py-3 bg-blue-50/40 flex items-center gap-3 text-sm">
                          <span className="text-gray-600">Set the department for the whole class:</span>
                          <select
                            defaultValue=""
                            onChange={(e) => bulkDepartment(group, e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">Choose...</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                      )}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">#</th>
                            <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Student</th>
                            <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Admission No.</th>
                            {needsDepartment && (
                              <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Department</th>
                            )}
                            <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.students.map((student, index) => (
                            <tr key={student.id} className="hover:bg-gray-50">
                              <td className="px-6 py-2 text-gray-400 text-xs">{index + 1}</td>
                              <td className="px-6 py-2 font-medium text-gray-800">
                                {student.first_name} {student.last_name}
                              </td>
                              <td className="px-6 py-2 text-gray-500 text-xs">
                                {student.admission_number}
                              </td>
                              {needsDepartment && (
                                <td className="px-6 py-2">
                                  <select
                                    value={deptChoice[student.id] || ''}
                                    onChange={(e) => setDeptChoice(prev => ({ ...prev, [student.id]: e.target.value }))}
                                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs"
                                  >
                                    <option value="">No department yet</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                  </select>
                                </td>
                              )}
                              <td className="px-6 py-2">
                                <div className="flex gap-2">
                                  {['Promoted', 'Demoted', 'Withdrawn'].map(status => (
                                    <button
                                      key={status}
                                      onClick={() => handleOverride(student.id, status)}
                                      className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                                        overrides[student.id] === status
                                          ? status === 'Promoted'
                                            ? 'bg-green-500 text-white'
                                            : status === 'Demoted'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-red-500 text-white'
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {withoutDepartment > 0 && !promoted && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              {withoutDepartment} student{withoutDepartment === 1 ? '' : 's'} moving into {departmentSectionName} have
              no department chosen. They will only get the core subjects until you set it on their profile.
            </div>
          )}

          {/* Promote Button */}
          {!promoted ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handlePromoteAll}
                disabled={promoting}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl transition disabled:opacity-60 text-sm"
              >
                {promoting ? 'Processing...' : `🎓 Promote All ${totalStudents} Students`}
              </button>
              <p className="text-xs text-gray-400">
                {totalPromoted} promoted · {totalDemoted} demoted · {totalWithdrawn} withdrawn
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
              <CheckCircle size={24} className="text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-green-700">Promotion Complete!</p>
                <p className="text-sm text-green-600 mt-0.5">
                  All students have been updated. Remember to create the new session
                  and update the current term in Sessions & Terms.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && selectedSession && classGroups.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          No active students found for this session.
        </div>
      )}
    </AdminLayout>
  )
}

export default PromoteStudents