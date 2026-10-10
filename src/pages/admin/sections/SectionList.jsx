import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'

const SectionList = () => {
  const { schoolId } = useAuthStore()
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [form, setForm] = useState({ name: '', order_number: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const fetchSections = async () => {
    const { data } = await supabase
      .from('school_sections')
      .select('*')
      .eq('school_id', schoolId)
      .order('order_number')
    setSections(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchSections()
  }, [schoolId])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        order_number: form.order_number === '' ? sections.length + 1 : Number(form.order_number),
        school_id: schoolId,
      }
      const nameTaken = sections.some(s =>
        s.id !== editingSection?.id && s.name.toLowerCase() === payload.name.toLowerCase()
      )
      if (nameTaken) throw new Error('A section with that name already exists.')

      if (editingSection) {
        const oldName = editingSection.name
        const { error } = await supabase.from('school_sections').update(payload).eq('id', editingSection.id)
        if (error) throw error

        // Other records store the section by name, so carry the new name across to them
        if (oldName !== payload.name) {
          for (const table of ['classes', 'students', 'subjects', 'fees']) {
            const { error: renameError } = await supabase
              .from(table)
              .update({ section: payload.name })
              .eq('school_id', schoolId)
              .eq('section', oldName)
            if (renameError) throw renameError
          }
        }
        setSuccess('Section updated!')
      } else {
        const { error } = await supabase.from('school_sections').insert([payload])
        if (error) throw error
        setSuccess('Section added!')
      }
      setForm({ name: '', order_number: '' })
      setShowForm(false)
      setEditingSection(null)
      fetchSections()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save section.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (section) => {
    setEditingSection(section)
    setForm({ name: section.name, order_number: section.order_number })
    setShowForm(true)
  }

  const handleDelete = async (section) => {
    // Refuse to delete a section that classes, students, subjects or fees still use
    const used = []
    for (const [table, label] of [['classes', 'class(es)'], ['students', 'student(s)'], ['subjects', 'subject(s)'], ['fees', 'fee(s)']]) {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('section', section.name)
      if (count > 0) used.push(`${count} ${label}`)
    }
    if (used.length > 0) {
      setError(`"${section.name}" is still used by ${used.join(', ')}. Move or remove those first.`)
      return
    }
    if (!window.confirm(`Delete "${section.name}"?`)) return
    setError('')
    await supabase.from('school_sections').delete().eq('id', section.id)
    fetchSections()
  }

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading sections...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Sections</h1>
          <p className="text-gray-500 text-sm mt-1">
            Define the age/level groupings your school uses — e.g. Nursery, Primary, Junior Secondary, Senior Secondary, or Lower Basic / Upper Basic, whatever fits.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingSection(null)
            setForm({ name: '', order_number: '' })
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Add Section
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
            {editingSection ? 'Edit Section' : 'New Section'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Junior Secondary"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={form.order_number}
                onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                placeholder={`${sections.length + 1}`}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingSection ? 'Update Section' : 'Add Section'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingSection(null) }}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2 max-w-md">
        {sections.length === 0 && (
          <p className="text-gray-400 text-sm">No sections yet — add your first one above.</p>
        )}
        {sections.map((section) => (
          <div
            key={section.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between"
          >
            <span className="font-semibold text-gray-800 text-sm">{section.name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(section)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(section)}
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

export default SectionList