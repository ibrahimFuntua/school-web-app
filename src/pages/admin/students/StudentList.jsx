import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Search, Eye, ToggleLeft, ToggleRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const StudentList = () => {
  const { schoolId } = useAuthStore()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSection, setFilterSection] = useState('All')
  const [filterStatus, setFilterStatus] = useState('Active')

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*, classes(name), arms(name)')
      .eq('school_id', schoolId)
      .order('first_name')

    setStudents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchStudents()
  }, [schoolId])

  const handleToggleStatus = async (student) => {
    const newStatus = student.status === 'Active' ? 'Withdrawn' : 'Active'
    await supabase
      .from('students')
      .update({ status: newStatus })
      .eq('id', student.id)
    await fetchStudents()
  }

  const filtered = students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    const matchSearch =
      fullName.includes(search.toLowerCase()) ||
      s.admission_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(search.toLowerCase())
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
            {students.filter(s => s.status === 'Active').length} active student{students.filter(s => s.status === 'Active').length !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/students/enroll')}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Enroll Student
        </button>
      </div>

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
          {['All', 'Nursery', 'Primary'].map(s => (
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
            {['All', 'Active', 'Withdrawn', 'Graduated', 'Promoted', 'Demoted'].map(s => (
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
                      student.section === 'Nursery'
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
    </AdminLayout>
  )
}

export default StudentList