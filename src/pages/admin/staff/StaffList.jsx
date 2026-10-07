import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Search, Eye, ToggleLeft, ToggleRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const StaffList = () => {
  const { schoolId } = useAuthStore()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')

  const fetchStaff = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('school_id', schoolId)
      .order('first_name')

    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchStaff()
  }, [schoolId])

  const handleToggleStatus = async (member) => {
    const newStatus = member.employment_status === 'Active' ? 'Suspended' : 'Active'
    await supabase
      .from('staff')
      .update({ employment_status: newStatus })
      .eq('id', member.id)
    await fetchStaff()
  }

  const filtered = staff.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    const matchSearch = fullName.includes(search.toLowerCase()) ||
      s.staff_id?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'All' || s.staff_type === filterType
    return matchSearch && matchType
  })

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading staff...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Staff</h1>
          <p className="text-gray-500 text-sm mt-1">
            {staff.length} staff member{staff.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/staff/register')}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Register Staff
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
            placeholder="Search by name or staff ID..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
        <div className="flex gap-2">
          {['All', 'Teaching', 'Non-Teaching'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterType === type
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff ID</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No staff found.
                  </td>
                </tr>
              )}
              {filtered.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {member.first_name} {member.middle_name ? member.middle_name + ' ' : ''}{member.last_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{member.staff_id}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      member.staff_type === 'Teaching'
                        ? 'bg-blue-50 text-primary'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {member.staff_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.role}</td>
                  <td className="px-6 py-4 text-gray-600">{member.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      member.employment_status === 'Active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {member.employment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/admin/staff/${member.id}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                        title="View Profile"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(member)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title="Toggle Status"
                      >
                        {member.employment_status === 'Active'
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

export default StaffList