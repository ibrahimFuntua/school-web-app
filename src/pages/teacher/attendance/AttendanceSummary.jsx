import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useTermStore } from '../../../store/termStore'

const AttendanceSummary = () => {
  const { user, schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const [assignedClasses, setAssignedClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [view, setView] = useState('term')
  const [weekStart, setWeekStart] = useState('')
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchClasses = async () => {
      const { data: staffData } = await supabase
        .from('staff').select('id').eq('auth_user_id', user.id).single()

      if (staffData) {
        const { data } = await supabase
  .from('teacher_classes')
  .select('*, classes(id, name), arms(id, name)')
  .eq('staff_id', staffData.id)

        setAssignedClasses(data || [])
        if (data?.length === 1) setSelectedClass(data[0])
      }
    }
    if (user && currentSession) fetchClasses()
  }, [user, currentSession])

  useEffect(() => {
    if (selectedClass) fetchSummary()
  }, [selectedClass, view, weekStart, currentTerm])

  const fetchSummary = async () => {
    if (!selectedClass || !currentTerm) return
    setLoading(true)

    // Build date range
    let startDate, endDate
    if (view === 'week' && weekStart) {
      startDate = weekStart
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 4)
      endDate = end.toISOString().split('T')[0]
    } else {
      startDate = currentTerm.start_date
      endDate = currentTerm.end_date
    }

    // Fetch students
    const studentQuery = supabase
      .from('students')
      .select('id, first_name, middle_name, last_name, admission_number')
      .eq('class_id', selectedClass.classes.id)
      .eq('status', 'Active')
      .order('first_name')

    if (selectedClass.arm_id) studentQuery.eq('arm_id', selectedClass.arm_id)

    const { data: students } = await studentQuery

    // Fetch attendance records
    const { data: records } = await supabase
      .from('attendance')
      .select('student_id, status, date')
      .in('student_id', students?.map(s => s.id) || [])
      .eq('term_id', currentTerm.id)
      .gte('date', startDate || '')
      .lte('date', endDate || '')

    // Build summary per student
    const summaryData = students?.map(student => {
      const studentRecords = records?.filter(r => r.student_id === student.id) || []
      return {
        ...student,
        present: studentRecords.filter(r => r.status === 'Present').length,
        absent: studentRecords.filter(r => r.status === 'Absent').length,
        late: studentRecords.filter(r => r.status === 'Late').length,
        excused: studentRecords.filter(r => r.status === 'Excused').length,
        total: studentRecords.length,
      }
    })

    setSummary(summaryData || [])
    setLoading(false)
  }

  const totalPresent = summary.reduce((s, r) => s + r.present, 0)
  const totalAbsent = summary.reduce((s, r) => s + r.absent, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Attendance Summary</h1>
        <p className="text-gray-500 text-sm mt-1">{currentTerm?.name} — {currentSession?.name}</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
            <div className="flex gap-2">
              {['term', 'week'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition capitalize ${
                    view === v
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 border border-gray-300 text-gray-600'
                  }`}
                >
                  {v === 'term' ? 'Full Term' : 'By Week'}
                </button>
              ))}
            </div>
          </div>

          {view === 'week' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting (Monday)</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400">Total Students</p>
            <p className="text-2xl font-bold text-primary">{summary.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400">Total Present</p>
            <p className="text-2xl font-bold text-green-600">{totalPresent}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400">Total Absent</p>
            <p className="text-2xl font-bold text-red-500">{totalAbsent}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400">Avg Attendance %</p>
            <p className="text-2xl font-bold text-amber-600">
              {summary.length > 0
                ? Math.round((totalPresent / (totalPresent + totalAbsent || 1)) * 100)
                : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Student Breakdown Table */}
      {loading ? (
        <p className="text-gray-400 animate-pulse">Loading summary...</p>
      ) : summary.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Present</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Absent</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Late</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Excused</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {summary.map((student, index) => {
                  const pct = student.total > 0
                    ? Math.round(((student.present + student.late) / student.total) * 100)
                    : 0
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{student.admission_number}</p>
                      </td>
                      <td className="px-6 py-4 text-green-600 font-semibold">{student.present}</td>
                      <td className="px-6 py-4 text-red-500 font-semibold">{student.absent}</td>
                      <td className="px-6 py-4 text-amber-500 font-semibold">{student.late}</td>
                      <td className="px-6 py-4 text-blue-500 font-semibold">{student.excused}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-16">
                            <div
                              className={`h-1.5 rounded-full ${
                                pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${
                            pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        selectedClass && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
            No attendance records found for this period.
          </div>
        )
      )}
    </div>
  )
}

export default AttendanceSummary