import { useEffect, useState } from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  Users, UserCog, BookOpen, Wallet,
  UserPlus, ClipboardList, TrendingUp, AlertCircle
} from 'lucide-react'

const COLORS = ['#1E3A8A', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6']

const AdminDashboard = () => {
  const { schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    feeCollected: 0,
    feeOutstanding: 0,
  })

  const [studentsByClass, setStudentsByClass] = useState([])
  const [feeChartData, setFeeChartData] = useState([])
  const [recentStudents, setRecentStudents] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [alertData, setAlertData] = useState({
    noTeacherClasses: 0,
    outstandingFees: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (schoolId) fetchDashboardData()
  }, [schoolId, currentTerm])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // --- STATS ---
      const [
        studentsRes,
        staffRes,
        classesRes,
        paymentsRes,
        feesRes,
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' })
          .eq('school_id', schoolId).eq('status', 'Active'),
        supabase.from('staff').select('id', { count: 'exact' })
          .eq('school_id', schoolId).eq('employment_status', 'Active'),
        supabase.from('classes').select('id', { count: 'exact' })
          .eq('school_id', schoolId).eq('is_active', true),
        currentTerm?.id
  ? supabase.from('payments').select('amount_paid, balance')
      .eq('school_id', schoolId)
      .eq('term_id', currentTerm.id)
  : Promise.resolve({ data: [] }),
currentTerm?.id
  ? supabase.from('fees').select('amount')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .eq('term_id', currentTerm.id)
  : Promise.resolve({ data: [] }),
      ])

      const totalCollected = paymentsRes.data?.reduce(
        (sum, p) => sum + Number(p.amount_paid), 0
      ) || 0
      const totalOutstanding = paymentsRes.data?.reduce(
        (sum, p) => sum + Number(p.balance), 0
      ) || 0

      setStats({
        totalStudents: studentsRes.count || 0,
        totalStaff: staffRes.count || 0,
        totalClasses: classesRes.count || 0,
        feeCollected: totalCollected,
        feeOutstanding: totalOutstanding,
      })

      // Fee pie chart data
      setFeeChartData([
        { name: 'Collected', value: totalCollected },
        { name: 'Outstanding', value: totalOutstanding },
      ])

      // --- STUDENTS PER CLASS ---
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name, students(id)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('section')
        .order('name')

      const classChartData = classData?.map(cls => ({
        name: cls.name,
        students: cls.students?.length || 0,
      })) || []
      setStudentsByClass(classChartData)

      // --- RECENT STUDENTS ---
      const { data: recentStudentsData } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, classes(name), created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentStudents(recentStudentsData || [])

      // --- RECENT PAYMENTS ---
      const { data: recentPaymentsData } = await supabase
        .from('payments')
        .select('id, receipt_number, amount_paid, payment_date, students(first_name, last_name), fees(name)')
        .eq('school_id', schoolId)
        .order('payment_date', { ascending: false })
        .limit(5)
      setRecentPayments(recentPaymentsData || [])

      // --- ALERTS ---
      // Classes with no teacher assigned
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_active', true)

      const { data: assignedClasses } = currentSession?.id
  ? await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('session_id', currentSession.id)
  : { data: [] }

      const assignedIds = new Set(assignedClasses?.map(a => a.class_id))
      const unassigned = allClasses?.filter(c => !assignedIds.has(c.id)).length || 0

      setAlertData({
        noTeacherClasses: unassigned,
        outstandingFees: totalOutstanding,
      })

    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse">Loading dashboard...</p>
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back — here's what's happening today.
        </p>
      </div>

      {/* Alerts */}
      {(alertData.noTeacherClasses > 0 || alertData.outstandingFees > 0) && (
        <div className="mb-6 space-y-2">
          {alertData.noTeacherClasses > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700">
                <span className="font-semibold">{alertData.noTeacherClasses}</span> class{alertData.noTeacherClasses > 1 ? 'es have' : ' has'} no teacher assigned this session.
              </p>
            </div>
          )}
          {alertData.outstandingFees > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-600">
                Outstanding fee balance this term: <span className="font-semibold">₦{alertData.outstandingFees.toLocaleString()}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Students',
            value: stats.totalStudents,
            icon: Users,
            color: 'bg-blue-50 text-primary',
            iconBg: 'bg-primary/10',
          },
          {
            label: 'Total Staff',
            value: stats.totalStaff,
            icon: UserCog,
            color: 'bg-amber-50 text-amber-600',
            iconBg: 'bg-amber-100',
          },
          {
            label: 'Total Classes',
            value: stats.totalClasses,
            icon: BookOpen,
            color: 'bg-green-50 text-green-600',
            iconBg: 'bg-green-100',
          },
          {
            label: 'Fee Collected',
            value: `₦${stats.feeCollected.toLocaleString()}`,
            icon: Wallet,
            color: 'bg-purple-50 text-purple-600',
            iconBg: 'bg-purple-100',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon size={16} className={card.color.split(' ')[1]} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.color.split(' ')[1]}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

        {/* Students per Class Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Students per Class
          </h2>
          {studentsByClass.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={studentsByClass} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="students"
                  fill="#1E3A8A"
                  radius={[4, 4, 0, 0]}
                  name="Students"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-300 text-sm">
              No class data yet
            </div>
          )}
        </div>

        {/* Fee Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Fee Overview
          </h2>
          {feeChartData[0]?.value > 0 || feeChartData[1]?.value > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={feeChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {feeChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? '#1E3A8A' : '#F59E0B'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `₦${Number(value).toLocaleString()}`}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-300 text-sm">
              No fee data yet
            </div>
          )}
        </div>

      </div>

      {/* Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Enrollments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Recent Enrollments
            </h2>
            <button
              onClick={() => navigate('/admin/students')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {recentStudents.length === 0 && (
              <p className="text-xs text-gray-400">No students enrolled yet.</p>
            )}
            {recentStudents.map(student => (
              <div key={student.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-bold">
                    {student.first_name?.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {student.classes?.name} · {student.admission_number}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Recent Payments
            </h2>
            <button
              onClick={() => navigate('/admin/fees/reports')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {recentPayments.length === 0 && (
              <p className="text-xs text-gray-400">No payments recorded yet.</p>
            )}
            {recentPayments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {payment.students?.first_name} {payment.students?.last_name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {payment.fees?.name}
                  </p>
                </div>
                <span className="text-sm font-bold text-green-600 shrink-0">
                  ₦{Number(payment.amount_paid).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {[
              {
                label: 'Enroll New Student',
                icon: UserPlus,
                path: '/admin/students/enroll',
                color: 'bg-blue-50 text-primary hover:bg-blue-100',
              },
              {
                label: 'Register Staff',
                icon: UserCog,
                path: '/admin/staff/register',
                color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
              },
              {
                label: 'Record Payment',
                icon: Wallet,
                path: '/admin/fees/payment',
                color: 'bg-green-50 text-green-600 hover:bg-green-100',
              },
              {
                label: 'View Fee Reports',
                icon: TrendingUp,
                path: '/admin/fees/reports',
                color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
              },
              {
                label: 'Manage Classes',
                icon: BookOpen,
                path: '/admin/classes',
                color: 'bg-gray-50 text-gray-600 hover:bg-gray-100',
              },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${action.color}`}
              >
                <action.icon size={16} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default AdminDashboard