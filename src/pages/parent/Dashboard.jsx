import { useEffect, useState } from 'react'
import ParentLayout from '../../components/layout/ParentLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, BookOpen, Wallet,
  FileText, User, CheckCircle, AlertCircle
} from 'lucide-react'

const ParentDashboard = () => {
  const { user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const navigate = useNavigate()

  const [parentData, setParentData] = useState(null)
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [childStats, setChildStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchParentData = async () => {
      if (!user) return
      setLoading(true)

      // Get parent record
      const { data: parent } = await supabase
        .from('parents')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!parent) { setLoading(false); return }
      setParentData(parent)

      // Get all children
      const { data: parentStudents } = await supabase
        .from('parent_students')
        .select('*, students(*, classes(name), arms(name))')
        .eq('parent_id', parent.id)

      const studentList = parentStudents?.map(ps => ps.students) || []
      setChildren(studentList)
      if (studentList.length > 0) setSelectedChild(studentList[0])

      setLoading(false)
    }
    fetchParentData()
  }, [user])

  useEffect(() => {
    if (selectedChild && currentTerm) fetchChildStats()
  }, [selectedChild, currentTerm])

  const fetchChildStats = async () => {
    if (!selectedChild || !currentTerm) return

    const [attendanceRes, gradesRes, paymentsRes, reportCardRes] = await Promise.all([
      supabase.from('attendance')
        .select('status')
        .eq('student_id', selectedChild.id)
        .eq('term_id', currentTerm.id),
      supabase.from('grades')
        .select('total')
        .eq('student_id', selectedChild.id)
        .eq('term_id', currentTerm.id),
      supabase.from('payments')
        .select('amount_paid, balance, payment_status')
        .eq('student_id', selectedChild.id),
      supabase.from('report_cards')
        .select('is_published')
        .eq('student_id', selectedChild.id)
        .eq('term_id', currentTerm.id)
        .single(),
    ])

    const attendance = attendanceRes.data || []
    const grades = gradesRes.data || []
    const payments = paymentsRes.data || []

    const totalPresent = attendance.filter(a =>
      a.status === 'Present' || a.status === 'Late'
    ).length
    const attendancePct = attendance.length > 0
      ? Math.round((totalPresent / attendance.length) * 100)
      : 0

    const totalScore = grades.reduce((s, g) => s + Number(g.total || 0), 0)
    const average = grades.length > 0
      ? (totalScore / grades.length).toFixed(1)
      : 0

    const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
    const totalBalance = payments.reduce((s, p) => s + Number(p.balance || 0), 0)
    const hasOutstanding = totalBalance > 0

    setChildStats({
      attendancePct,
      totalPresent,
      totalDays: attendance.length,
      average,
      totalSubjects: grades.length,
      totalPaid,
      totalBalance,
      hasOutstanding,
      reportPublished: reportCardRes.data?.is_published || false,
    })
  }

  if (loading) return (
    <ParentLayout>
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    </ParentLayout>
  )

  return (
    <ParentLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">
          Welcome 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {currentSession?.name} — {currentTerm?.name || 'No active term'}
        </p>
      </div>

      {/* Children Tabs */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                selectedChild?.id === child.id
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {child.first_name} {child.last_name}
            </button>
          ))}
        </div>
      )}

      {/* No children */}
      {children.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          <User size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No children linked to your account.</p>
          <p className="text-xs mt-1">Contact the school admin.</p>
        </div>
      )}

      {/* Selected Child Info */}
      {selectedChild && (
        <>
          {/* Student Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-xl">
                  {selectedChild.first_name?.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">
                  {selectedChild.first_name} {selectedChild.middle_name} {selectedChild.last_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedChild.admission_number} · {selectedChild.classes?.name}
                  {selectedChild.arms?.name ? ` ${selectedChild.arms.name}` : ''} · {selectedChild.section}
                </p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${
                  selectedChild.status === 'Active'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedChild.status}
                </span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {childStats && (
            <div className="space-y-2 mb-5">
              {childStats.hasOutstanding && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700">
                    Outstanding fee balance:
                    <span className="font-semibold"> ₦{childStats.totalBalance.toLocaleString()}</span>
                  </p>
                </div>
              )}
              {childStats.reportPublished && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle size={16} className="text-green-500 shrink-0" />
                  <p className="text-sm text-green-700">
                    Report card is available for this term!
                  </p>
                  <button
                    onClick={() => navigate('/parent/report-card')}
                    className="ml-auto text-xs bg-green-600 text-white px-3 py-1 rounded-lg"
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stats Cards */}
          {childStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Attendance</p>
                <p className={`text-2xl font-bold ${
                  childStats.attendancePct >= 75 ? 'text-green-600' :
                  childStats.attendancePct >= 50 ? 'text-amber-500' :
                  'text-red-500'
                }`}>
                  {childStats.attendancePct}%
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {childStats.totalPresent}/{childStats.totalDays} days
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Average Score</p>
                <p className={`text-2xl font-bold ${
                  Number(childStats.average) >= 75 ? 'text-green-600' :
                  Number(childStats.average) >= 50 ? 'text-amber-500' :
                  'text-red-500'
                }`}>
                  {childStats.average > 0 ? `${childStats.average}%` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {childStats.totalSubjects} subjects
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Fees Paid</p>
                <p className="text-xl font-bold text-green-600">
                  ₦{childStats.totalPaid.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Balance</p>
                <p className={`text-xl font-bold ${
                  childStats.totalBalance > 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  ₦{childStats.totalBalance.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Attendance',
                icon: ClipboardList,
                path: '/parent/attendance',
                color: 'bg-blue-50 text-primary hover:bg-blue-100',
              },
              {
                label: 'Grades',
                icon: BookOpen,
                path: '/parent/grades',
                color: 'bg-green-50 text-green-600 hover:bg-green-100',
              },
              {
                label: 'Fee History',
                icon: Wallet,
                path: '/parent/fees',
                color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
              },
              {
                label: 'Report Card',
                icon: FileText,
                path: '/parent/report-card',
                color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
              },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`flex flex-col items-center gap-2 px-4 py-5 rounded-2xl text-sm font-medium transition ${action.color}`}
              >
                <action.icon size={22} />
                <span className="text-xs text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </ParentLayout>
  )
}

export default ParentDashboard