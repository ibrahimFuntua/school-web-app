import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

const SECTION_OPTIONS = ['Nursery', 'Primary', 'Both']

const SubjectList = () => {
  const { schoolId } = useAuthStore()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', section: '' })
  const [editingSubject, setEditingSubject] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const fetchSubjects = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subjects')
      .select('*')
      .eq('school_id', schoolId)
      .order('section')
      .order('name')

    setSubjects(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchSubjects()
  }, [schoolId])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update({ ...form, updated_at: new Date() })
          .eq('id', editingSubject.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert([{ ...form, school_id: schoolId }])
        if (error) throw error
      }

      setSuccess(editingSubject ? 'Subject updated!' : 'Subject added!')
      setShowForm(false)
      setEditingSubject(null)
      setForm({ name: '', section: '' })
      await fetchSubjects()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save subject.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (subject) => {
    setEditingSubject(subject)
    setForm({ name: subject.name, section: subject.section })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleActive = async (subject) => {
    await supabase
      .from('subjects')
      .update({ is_active: !subject.is_active })
      .eq('id', subject.id)
    await fetchSubjects()
  }

  const nurserySubjects = subjects.filter(s => s.section === 'Nursery' || s.section === 'Both')
  const primarySubjects = subjects.filter(s => s.section === 'Primary' || s.section === 'Both')

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading subjects...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Subjects</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage subjects for Nursery and Primary sections.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingSubject(null)
            setForm({ name: '', section: '' })
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Add Subject
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

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {editingSubject ? 'Edit Subject' : 'New Subject'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Mathematics, English Language"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section <span className="text-red-500">*</span>
              </label>
              <select
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Section</option>
                {SECTION_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim() || !form.section}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingSubject ? 'Update Subject' : 'Add Subject'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingSubject(null) }}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects List */}
      {[
        { label: 'Nursery Subjects', data: nurserySubjects },
        { label: 'Primary Subjects', data: primarySubjects },
      ].map(({ label, data }) => (
        <div key={label} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {label}
          </h2>

          {data.length === 0 && (
            <p className="text-gray-400 text-sm">No subjects added yet.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-w-4xl">
            {data.map((subject) => (
              <div
                key={subject.id}
                className={`bg-white rounded-xl shadow-sm border px-5 py-4 flex items-center justify-between ${
                  subject.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
                }`}
              >
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{subject.name}</p>
                  <span className="text-xs text-gray-400">{subject.section}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(subject)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(subject)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                  >
                    {subject.is_active
                      ? <ToggleRight size={18} className="text-primary" />
                      : <ToggleLeft size={18} className="text-gray-400" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </AdminLayout>
  )
}

export default SubjectList