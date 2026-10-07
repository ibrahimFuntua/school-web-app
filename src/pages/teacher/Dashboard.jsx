import { useEffect, useState } from 'react'
import TeacherLayout from '../../components/layout/TeacherLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, BookOpen, BarChart2,
  FileText, Users, CheckCircle
} from 'lucide-react'
import { cacheStudents, cacheClasses, cacheSubjects, cacheTeacherMeta } from '../../lib/offlineDB'
import { attachDepartmentLinks } from '../../lib/departmentUtils'

const TeacherDashboard = () => {
  const { user, schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const navigate = useNavigate()

  const [staffName, setStaffName] = useState('')
  const [assignedClasses, setAssignedClasses] = useState([])
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      setLoading(true)

      // Get staff info
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .eq('auth_user_id', user.id)
        .single()

      if (staffData) {
        setStaffName(`${staffData.first_name} ${staffData.last_name}`)

        // Get assigned classes
        const { data: classData } = await supabase
  .from('teacher_classes')
  .select('*, classes(id, name, section), arms(id, name, department_id)')
  .eq('staff_id', staffData.id)
        setAssignedClasses(classData || [])

        // Cache everything a teacher needs to work offline
        if (classData?.length > 0 && navigator.onLine) {
          cacheTeacherMeta(staffData.id, classData)
          await cacheClasses(classData.map(c => c.classes))

          const classIds = classData.map(c => c.classes.id)
          const { data: allStudents } = await supabase
            .from('students')
            .select('id, first_name, middle_name, last_name, admission_number, class_id, arm_id, department_id')
            .in('class_id', classIds)
            .eq('status', 'Active')
          if (allStudents) await cacheStudents(allStudents)

          const sections = [...new Set(classData.map(c => c.classes.section))]
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .or(`section.is.null,section.in.(${sections.map(s => `"${s}"`).join(',')})`)
          if (subjectData) await cacheSubjects(await attachDepartmentLinks(subjectData))
        }

        // Today's attendance summary
        const today = new Date().toISOString().split('T')[0]
        if (classData?.length > 0) {
          const classIds = classData.map(c => c.class_id)
          const { data: attData } = await supabase
            .from('attendance')
            .select('status')
            .in('class_id', classIds)
            .eq('date', today)
            .eq('term_id', currentTerm?.id || '')

          if (attData && attData.length > 0) {
            setTodayAttendance({
              present: attData.filter(a => a.status === 'Present').length,
              absent: attData.filter(a => a.status === 'Absent').length,
              late: attData.filter(a => a.status === 'Late').length,
              total: attData.length,
              marked: true,
            })
          } else {
            setTodayAttendance({ marked: false })
          }
        }
      }
      setLoading(false)
    }
    if (currentSession) fetchData()
  }, [user, currentSession, currentTerm])

  if (loading) return (
    <TeacherLayout>
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    </TeacherLayout>
  )

  return (
    <TeacherLayout>
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">
          Welcome, {staffName || 'Teacher'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {currentSession?.name} — {currentTerm?.name || 'No active term'}
        </p>
      </div>

      {/* Today's Attendance Alert */}
      {todayAttendance && (
        <div className={`mb-6 rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${
          todayAttendance.marked
            ? 'bg-green-50 border border-green-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <CheckCircle
              size={18}
              className={todayAttendance.marked ? 'text-green-500' : 'text-amber-500'}
            />
            <div>
              <p className={`text-sm font-semibold ${
                todayAttendance.marked ? 'text-green-700' : 'text-amber-700'
              }`}>
                {todayAttendance.marked
                  ? "Today's attendance marked ✅"
                  : "Today's attendance not marked yet"
                }
              </p>
              {todayAttendance.marked && (
                <p className="text-xs text-green-600 mt-0.5">
                  Present: {todayAttendance.present} |
                  Absent: {todayAttendance.absent} |
                  Late: {todayAttendance.late}
                </p>
              )}
            </div>
          </div>
          {!todayAttendance.marked && (
            <button
              onClick={() => navigate('/teacher/attendance')}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Mark Now
            </button>
          )}
        </div>
      )}

      {/* Assigned Classes */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          My Classes
        </h2>
        {assignedClasses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No classes assigned yet.</p>
            <p className="text-xs mt-1">Contact admin to get classes assigned.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assignedClasses.map(cls => (
              <div
                key={`${cls.class_id}_${cls.arm_id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {cls.classes?.name}
                      {cls.arms?.name ? ` ${cls.arms.name}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">{cls.classes?.section} Section</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Mark Attendance',
              icon: ClipboardList,
              path: '/teacher/attendance',
              color: 'bg-blue-50 text-primary hover:bg-blue-100',
            },
            {
              label: 'Attendance Summary',
              icon: BarChart2,
              path: '/teacher/attendance/summary',
              color: 'bg-green-50 text-green-600 hover:bg-green-100',
            },
            {
              label: 'Enter Grades',
              icon: BookOpen,
              path: '/teacher/grades',
              color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
            },
            {
              label: 'Report Cards',
              icon: FileText,
              path: '/teacher/report-cards',
              color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
            },
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`flex flex-col items-center gap-2 px-4 py-5 rounded-2xl text-sm font-medium transition ${action.color}`}
            >
              <action.icon size={22} />
              <span className="text-center text-xs">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </TeacherLayout>
  )
}

export default TeacherDashboard