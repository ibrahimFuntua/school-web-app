import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'

const DepartmentList = () => {
  const { schoolId } = useAuthStore()
  const [school, setSchool] = useState(null)
  const [sectionName, setSectionName] = useState('')
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const fetchData = async () => {
    const { data: schoolData } = await supabase
      .from('schools')
      .select('department_section_id, department_mode')
      .eq('id', schoolId)
      .single()
    setSchool(schoolData)

    if (schoolData?.department_section_id) {
      const { data: sectionData } = await supabase
        .from('school_sections')
        .select('name')
        .eq('id', schoolData.department_section_id)
        .single()
      setSectionName(sectionData?.name || '')

      const { data: deptData } = await supabase
        .from('departments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('section_id', schoolData.department_section_id)
        .order('name')
      setDepartments(deptData || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchData()
  }, [schoolId])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        school_id: schoolId,
        section_id: school.department_section_id,
      }
      if (editingDepartment) {
        const { error } = await supabase.from('departments').update(payload).eq('id', editingDepartment.id)
        if (error) throw error
        setSuccess('Department updated!')
      } else {
        const { error } = await supabase.from('departments').insert([payload])
        if (error) throw error
        setSuccess('Department added!')
      }
      setName('')
      setShowForm(false)
      setEditingDepartment(null)
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save department.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (dept) => {
    setEditingDepartment(dept)
    setName(dept.name)
    setShowForm(true)
  }

  const handleDelete = async (dept) => {
    if (!window.confirm(`Delete "${dept.name}"? Arms or students already assigned to it will need to be reassigned.`)) return
    await supabase.from('departments').delete().eq('id', dept.id)
    fetchData()
  }

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading departments...</p>
    </AdminLayout>
  )

  if (!school?.department_section_id) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg">
          <h1 className="text-xl font-bold text-primary mb-2">Departments</h1>
          <p className="text-sm text-gray-500 mb-4">
            Departments haven't been set up yet. Go to School Settings → Departments,
            pick which section uses them, and how students are grouped, then come back here.
          </p>
          <a
            href="/admin/settings"
            className="inline-block text-sm text-primary font-medium hover:underline"
          >
            → Go to School Settings
          </a>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Departments</h1>
          <p className="text-gray-500 text-sm mt-1">
            {sectionName} departments — e.g. Science, Arts, Commercial, Technical.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingDepartment(null)
            setName('')
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Add Department
        </button>
      </div>

      {success && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-md mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {editingDepartment ? 'Edit Department' : 'New Department'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Science"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingDepartment ? 'Update Department' : 'Add Department'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingDepartment(null) }}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2 max-w-md">
        {departments.length === 0 && (
          <p className="text-gray-400 text-sm">No departments yet — add your first one above.</p>
        )}
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between"
          >
            <span className="font-semibold text-gray-800 text-sm">{dept.name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(dept)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(dept)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}

export default DepartmentList