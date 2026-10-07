import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useTermStore } from '../../../store/termStore'
import { CheckCircle, XCircle, Clock, FileCheck } from 'lucide-react'
import { savePendingAttendance, getCachedStudents, getCachedTeacherMeta } from '../../../lib/offlineDB'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'

const STATUS_OPTIONS = ['Present', 'Absent', 'Late', 'Excused']

const statusStyle = {
  Present: 'bg-green-100 text-green-700 border-green-300',
  Absent: 'bg-red-100 text-red-600 border-red-300',
  Late: 'bg-amber-100 text-amber-600 border-amber-300',
  Excused: 'bg-blue-100 text-blue-600 border-blue-300',
}

const MarkAttendance = () => {
  const { schoolId, user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const { checkPending } = useOnlineStatus()

  const [staffId, setStaffId] = useState(null)
  const [assignedClasses, setAssignedClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [date, setDate] = useState(new Date().toLocaleDateString('en-GB'))
  const [isHoliday, setIsHoliday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Fetch staff ID and assigned classes
  useEffect(() => {
    const fetchStaffData = async () => {
      if (navigator.onLine) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()

        if (staffData) {
          setStaffId(staffData.id)
          const { data: classData } = await supabase
    .from('teacher_classes')
    .select('*, classes(id, name, section), arms(id, name)')
    .eq('staff_id', staffData.id)

          setAssignedClasses(classData || [])
          if (classData?.length === 1) setSelectedClass(classData[0])
        }
      } else {
        // Offline — fall back to what Dashboard cached on the last online visit
        const { staffId: cachedStaffId, assignedClasses: cachedClasses } = getCachedTeacherMeta()
        if (cachedStaffId) {
          setStaffId(cachedStaffId)
          setAssignedClasses(cachedClasses)
          if (cachedClasses.length === 1) setSelectedClass(cachedClasses[0])
        }
      }
      setLoading(false)
    }
    if (user && currentSession) fetchStaffData()
  }, [user, currentSession])

  // Parse dd/mm/yyyy to ISO
  const parseToISO = (dateStr) => {
    const [day, month, year] = dateStr.split('/')
    return `${year}-${month}-${day}`
  }

  // Check holiday & load students when class or date changes
  useEffect(() => {
    const loadAttendanceData = async () => {
      if (!selectedClass || !date) return
      setError('')
      setIsHoliday(null)

      const isoDate = parseToISO(date)

      // Check if holiday
      const { data: holiday } = await supabase
        .from('school_holidays')
        .select('*')
        .eq('school_id', schoolId)
        .eq('date', isoDate)
        .single()

      if (holiday) {
        setIsHoliday(holiday)
        return
      }

      // Check if weekend
      const dayOfWeek = new Date(isoDate).getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        setIsHoliday({ reason: 'Weekend', holiday_type: 'Weekend' })
        return
      }

      // Fetch students
      let studentData
      if (navigator.onLine) {
        const query = supabase
          .from('students')
          .select('id, first_name, middle_name, last_name, admission_number')
          .eq('class_id', selectedClass.classes.id)
          .eq('status', 'Active')
          .order('first_name')

        if (selectedClass.arm_id) {
          query.eq('arm_id', selectedClass.arm_id)
        }

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

      // Check existing attendance for this date (only possible online)
      const attendanceMap = {}
      let existingAttendance = null
      if (navigator.onLine) {
        const res = await supabase
          .from('attendance')
          .select('*')
          .in('student_id', studentData.map(s => s.id))
          .eq('date', isoDate)
        existingAttendance = res.data
      }

      if (existingAttendance?.length > 0) {
        existingAttendance.forEach(a => {
          attendanceMap[a.student_id] = a.status
        })
      } else {
        // Default all to Present (also the offline case — no way to know
        // what was already marked without a connection)
        studentData.forEach(s => {
          attendanceMap[s.id] = 'Present'
        })
      }
      setAttendance(attendanceMap)
    }

    loadAttendanceData()
  }, [selectedClass, date])

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  const handleMarkAll = (status) => {
    const updated = {}
    students.forEach(s => { updated[s.id] = status })
    setAttendance(updated)
  }

  const handleSubmit = async () => {
    if (!currentTerm || !currentSession) {
      setError('No active term set. Please contact admin.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const isoDate = parseToISO(date)
      const records = students.map(student => ({
        student_id: student.id,
        class_id: selectedClass.classes.id,
        arm_id: selectedClass.arm_id || null,
        session_id: currentSession.id,
        term_id: currentTerm.id,
        date: isoDate,
        status: attendance[student.id] || 'Absent',
        marked_by: staffId,
      }))

      if (navigator.onLine) {
        // Online — save directly to Supabase
        const { error } = await supabase
          .from('attendance')
          .upsert(records, { onConflict: 'student_id,date' })

        if (error) throw error
        setSuccess(`Attendance saved for ${date}!`)
      } else {
        // Offline — save to IndexedDB, syncs automatically when back online
        await savePendingAttendance(records)
        setSuccess(`📱 Saved offline for ${date} — will sync when connected`)
        checkPending()
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save attendance. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Summary counts
  const summary = {
    total: students.length,
    present: Object.values(attendance).filter(s => s === 'Present').length,
    absent: Object.values(attendance).filter(s => s === 'Absent').length,
    late: Object.values(attendance).filter(s => s === 'Late').length,
    excused: Object.values(attendance).filter(s => s === 'Excused').length,
  }

  if (loading) return <p className="text-gray-400 animate-pulse p-6">Loading...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Mark Attendance</h1>
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

      {/* Class & Date Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <option
                  key={`${cls.class_id}_${cls.arm_id || ''}`}
                  value={`${cls.class_id}_${cls.arm_id || ''}`}
                >
                  {cls.classes?.name}{cls.arms?.name ? ` ${cls.arms.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            />
            <p className="text-xs text-gray-400 mt-1">
              Change date to backdate attendance
            </p>
          </div>
        </div>
      </div>

      {/* Holiday Warning */}
      {isHoliday && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5">
          <p className="text-amber-700 font-semibold text-sm">
            🏖️ {isHoliday.holiday_type === 'Weekend' ? 'This is a weekend' : `This day is a ${isHoliday.holiday_type}`}
          </p>
          {isHoliday.reason && isHoliday.holiday_type !== 'Weekend' && (
            <p className="text-amber-600 text-sm mt-1">Reason: {isHoliday.reason}</p>
          )}
          <p className="text-amber-500 text-xs mt-1">Attendance cannot be marked for this date.</p>
        </div>
      )}

      {/* Attendance Table */}
      {!isHoliday && selectedClass && students.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Summary Bar */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 flex-wrap">
            <span className="text-sm text-gray-500">Total: <strong>{summary.total}</strong></span>
            <span className="text-sm text-green-600">Present: <strong>{summary.present}</strong></span>
            <span className="text-sm text-red-500">Absent: <strong>{summary.absent}</strong></span>
            <span className="text-sm text-amber-500">Late: <strong>{summary.late}</strong></span>
            <span className="text-sm text-blue-500">Excused: <strong>{summary.excused}</strong></span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => handleMarkAll('Present')}
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
              >
                Mark All Present
              </button>
              <button
                onClick={() => handleMarkAll('Absent')}
                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
              >
                Mark All Absent
              </button>
            </div>
          </div>
{/* Mobile Legend */}
<div className="flex items-center gap-3 px-6 py-2 bg-gray-50 border-b border-gray-100 lg:hidden">
  <span className="text-xs text-gray-400">Key:</span>
  <span className="text-xs text-green-600 font-medium">P = Present</span>
  <span className="text-xs text-red-500 font-medium">A = Absent</span>
  <span className="text-xs text-amber-500 font-medium">L = Late</span>
  <span className="text-xs text-blue-500 font-medium">E = Excused</span>
</div>
          {/* Student List */}
          <div className="divide-y divide-gray-50">
            {students.map((student, index) => (
              <div key={student.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6">{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {student.first_name} {student.middle_name ? student.middle_name + ' ' : ''}{student.last_name}
                    </p>
                    <p className="text-xs text-gray-400">{student.admission_number}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
  {STATUS_OPTIONS.map(status => (
    <button
      key={status}
      onClick={() => handleStatusChange(student.id, status)}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
        attendance[student.id] === status
          ? statusStyle[status]
          : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
      }`}
    >
      {status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Late' ? 'L' : 'E'}
    </button>
  ))}
</div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {Object.keys(attendance).length} of {students.length} marked
            </p>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
            >
              <FileCheck size={16} />
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}

      {!isHoliday && selectedClass && students.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          No active students found in this class.
        </div>
      )}
    </div>
  )
}

export default MarkAttendance