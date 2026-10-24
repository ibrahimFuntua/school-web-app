import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Search, Eye, ToggleLeft, ToggleRight, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSections } from '../../../hooks/useSections'
import { fetchAllRows } from '../../../lib/feeUtils'

const WITHDRAW_REASONS = ['Relocated', 'Transferred to another school', 'School fees', 'Health', 'Other']

const StudentList = () => {
  const { schoolId } = useAuthStore()
  const { sectionNames, restricted, loading: sectionsLoading } = useSections()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSection, setFilterSection] = useState('All')
  const [filterStatus, setFilterStatus] = useState('Active')
  const [activeCount, setActiveCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [withdrawTarget, setWithdrawTarget] = useState(null)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawDate, setWithdrawDate] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  // A Head Teacher / Principal only sees students of the sections they manage
  const scopeToMySections = (query) =>
    restricted ? query.in('section', sectionNames.length > 0 ? sectionNames : ['__none__']) : query

  const fetchStudents = async () => {
    setLoading(true)
    setLoadError('')
    try {
      // Only the columns the list shows, and only the status being viewed.
      // fetchAllRows pages through the results, so nobody is lost past 1000 rows.
      const rows = await fetchAllRows(() => {
        let q = supabase
          .from('students')
          .select('id, first_name, middle_name, last_name, admission_number, section, gender, status, classes(name), arms(name)')
          .eq('school_id', schoolId)
          .order('first_name')
          .order('id')
        if (filterStatus !== 'All') q = q.eq('status', filterStatus)
        return scopeToMySections(q)
      })
      setStudents(rows)

      const { count } = await scopeToMySections(
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('status', 'Active')
      )
      setActiveCount(count || 0)
    } catch (err) {
      console.error('Load students error:', err)
      setLoadError('Could not load the students. Please refresh and try again.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId && !sectionsLoading) fetchStudents()
  }, [schoolId, sectionsLoading, filterStatus])

  const todayIso = () => new Date().toISOString().split('T')[0]

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return
    setWithdrawing(true)
    const { error } = await supabase
      .from('students')
      .update({
        status: 'Withdrawn',
        withdrawn_on: withdrawDate || todayIso(),
        withdrawal_reason: withdrawReason || null,
      })
      .eq('id', withdrawTarget.id)
    setWithdrawing(false)
    if (error) {
      setLoadError('Could not withdraw this student. Please try again.')
      setWithdrawTarget(null)
      return
    }
    setWithdrawTarget(null)
    await fetchStudents()
  }

  const handleToggleStatus = async (student) => {
    // Withdrawing asks for a reason and date first
    if (student.status === 'Active') {
      setWithdrawTarget(student)
      setWithdrawReason('')
      setWithdrawDate(todayIso())
      return
    }
    // Bringing a student back clears the withdrawal details
    const { error } = await supabase
      .from('students')
      .update({ status: 'Active', withdrawn_on: null, withdrawal_reason: null })
      .eq('id', student.id)
    if (error) setLoadError('Could not reactivate this student. Please try again.')
    await fetchStudents()
  }

  const filtered = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    const matchSearch =
      fullName.includes(search.toLowerCase()) ||
      s.admission_number?.toLowerCase().includes(search.toLowerCase())
    const matchSection = filterSection === 'All' || s.section === filterSection
    const matchStatus = filterStatus === 'All' || s.status === filterStatus
    return matchSearch && matchSection && matchStatus
  })

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading students...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Students</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCount} active student{activeCount !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/students/import')}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Upload size={16} />
            Import from Excel
          </button>
          <button
            onClick={() => navigate('/admin/students/enroll')}
            className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <PlusCircle size={16} />
            Enroll Student
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {loadError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or admission number..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...sectionNames].map(s => (
            <button
              key={s}
              onClick={() => setFilterSection(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterSection === s
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            {['Active', 'Withdrawn', 'Graduated', 'All'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admission No.</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Section</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No students found.
                  </td>
                </tr>
              )}
              {filtered.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {student.first_name} {student.middle_name ? student.middle_name + ' ' : ''}{student.last_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{student.admission_number}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      student.section === sectionNames[0]
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-blue-50 text-primary'
                    }`}>
                      {student.section}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {student.classes?.name}
                    {student.arms?.name ? ` ${student.arms.name}` : ''}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{student.gender}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      student.status === 'Active'
                        ? 'bg-green-50 text-green-700'
                        : student.status === 'Withdrawn'
                        ? 'bg-red-50 text-red-500'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/admin/students/${student.id}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                        title="View Profile"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(student)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title="Toggle Status"
                      >
                        {student.status === 'Active'
                          ? <ToggleRight size={18} className="text-primary" />
                          : <ToggleLeft size={18} className="text-gray-400" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdraw student modal */}
      {withdrawTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Withdraw student</h3>
            <p className="text-sm text-gray-500 mb-5">
              {withdrawTarget.first_name} {withdrawTarget.last_name} · {withdrawTarget.admission_number}
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={withdrawDate}
              onChange={(e) => setWithdrawDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={WITHDRAW_REASONS.includes(withdrawReason) ? withdrawReason : (withdrawReason ? 'Other' : '')}
              onChange={(e) => setWithdrawReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a reason (optional)</option>
              {WITHDRAW_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {withdrawReason !== '' && !WITHDRAW_REASONS.slice(0, -1).includes(withdrawReason) && (
              <input
                value={withdrawReason === 'Other' ? '' : withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value || 'Other')}
                placeholder="Type the reason"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={confirmWithdraw}
                disabled={withdrawing}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {withdrawing ? 'Saving...' : 'Withdraw student'}
              </button>
              <button
                onClick={() => setWithdrawTarget(null)}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default StudentList