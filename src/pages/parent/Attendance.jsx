import { useEffect, useState } from 'react'
import ParentLayout from '../../components/layout/ParentLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'

const ParentAttendance = () => {
  const { user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChildren = async () => {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!parent) return

      const { data } = await supabase
        .from('parent_students')
        .select('*, students(*, classes(name), arms(name))')
        .eq('parent_id', parent.id)

      const list = data?.map(ps => ps.students) || []
      setChildren(list)
      if (list.length > 0) setSelectedChild(list[0])
      setLoading(false)
    }
    if (user) fetchChildren()
  }, [user])

  useEffect(() => {
    if (selectedChild && currentTerm) fetchAttendance()
  }, [selectedChild, currentTerm])

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', selectedChild.id)
      .eq('term_id', currentTerm.id)
      .order('date', { ascending: false })

    setAttendance(data || [])

    const present = data?.filter(a => a.status === 'Present' || a.status === 'Late').length || 0
    const absent = data?.filter(a => a.status === 'Absent').length || 0
    const late = data?.filter(a => a.status === 'Late').length || 0
    const excused = data?.filter(a => a.status === 'Excused').length || 0

    setSummary({
      total: data?.length || 0,
      present,
      absent,
      late,
      excused,
      percentage: data?.length > 0 ? Math.round((present / data.length) * 100) : 0,
    })
  }

  const statusStyle = {
    Present: 'bg-green-50 text-green-700',
    Absent: 'bg-red-50 text-red-600',
    Late: 'bg-amber-50 text-amber-600',
    Excused: 'bg-blue-50 text-blue-600',
  }

  if (loading) return (
    <ParentLayout>
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </ParentLayout>
  )

  return (
    <ParentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">
          {currentTerm?.name} — {currentSession?.name}
        </p>
      </div>

      {/* Child Tabs */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
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

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Days', value: summary.total, color: 'text-primary' },
            { label: 'Present', value: summary.present, color: 'text-green-600' },
            { label: 'Absent', value: summary.absent, color: 'text-red-500' },
            { label: 'Late', value: summary.late, color: 'text-amber-500' },
            { label: 'Attendance %', value: `${summary.percentage}%`, color: summary.percentage >= 75 ? 'text-green-600' : 'text-red-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-10 text-gray-400">
                    No attendance records found for this term.
                  </td>
                </tr>
              )}
              {attendance.map(record => (
                <tr key={record.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3 text-gray-700">
                    {new Date(record.date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusStyle[record.status]}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ParentLayout>
  )
}

export default ParentAttendance