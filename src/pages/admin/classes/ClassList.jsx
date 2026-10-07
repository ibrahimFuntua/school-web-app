import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { SECTIONS } from '../../../lib/constants'
import { PlusCircle, ChevronDown, ChevronUp, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

const ClassList = () => {
  const { schoolId } = useAuthStore()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New class form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', section: '', has_arms: false })
  const [arms, setArms] = useState([''])
  const [saving, setSaving] = useState(false)

  // Edit
  const [editingClass, setEditingClass] = useState(null)

  const fetchClasses = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('classes')
      .select('*, arms(*)')
      .eq('school_id', schoolId)
      .order('section')
      .order('name')

    setClasses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchClasses()
  }, [schoolId])

  const handleAddArm = () => setArms([...arms, ''])
  const handleArmChange = (index, value) => {
    const updated = [...arms]
    updated[index] = value
    setArms(updated)
  }
  const handleRemoveArm = (index) => {
    setArms(arms.filter((_, i) => i !== index))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingClass) {
        // Update class
        const { error } = await supabase
          .from('classes')
          .update({
            name: form.name,
            section: form.section,
            has_arms: form.has_arms,
            updated_at: new Date(),
          })
          .eq('id', editingClass.id)

        if (error) throw error

        // If has arms, add new arms
        if (form.has_arms) {
          const validArms = arms.filter(a => a.trim())
          const existingArms = editingClass.arms?.map(a => a.name) || []
          const newArms = validArms.filter(a => !existingArms.includes(a))

          if (newArms.length > 0) {
            await supabase.from('arms').insert(
              newArms.map(name => ({ class_id: editingClass.id, name }))
            )
          }
        }
      } else {
        // Create class
        const { data: newClass, error } = await supabase
          .from('classes')
          .insert([{
            school_id: schoolId,
            name: form.name,
            section: form.section,
            has_arms: form.has_arms,
          }])
          .select()
          .single()

        if (error) throw error

        // Create arms if needed
        if (form.has_arms) {
          const validArms = arms.filter(a => a.trim())
          if (validArms.length > 0) {
            await supabase.from('arms').insert(
              validArms.map(name => ({ class_id: newClass.id, name }))
            )
          }
        }
      }

      setSuccess(editingClass ? 'Class updated!' : 'Class added!')
      setShowForm(false)
      setEditingClass(null)
      setForm({ name: '', section: '', has_arms: false })
      setArms([''])
      await fetchClasses()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save class. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (cls) => {
    setEditingClass(cls)
    setForm({ name: cls.name, section: cls.section, has_arms: cls.has_arms })
    setArms(cls.arms?.map(a => a.name) || [''])
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleActive = async (cls) => {
    await supabase
      .from('classes')
      .update({ is_active: !cls.is_active })
      .eq('id', cls.id)
    await fetchClasses()
  }

  const handleToggleArmActive = async (arm) => {
    await supabase
      .from('arms')
      .update({ is_active: !arm.is_active })
      .eq('id', arm.id)
    await fetchClasses()
  }

  const nurseryClasses = classes.filter(c => c.section === 'Nursery')
  const primaryClasses = classes.filter(c => c.section === 'Primary')

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading classes...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage all classes and their arms.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingClass(null)
            setForm({ name: '', section: '', has_arms: false })
            setArms([''])
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Add Class
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

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {editingClass ? 'Edit Class' : 'New Class'}
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Nursery 1, Primary 3"
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
                {SECTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="has_arms"
                checked={form.has_arms}
                onChange={(e) => setForm({ ...form, has_arms: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="has_arms" className="text-sm font-medium text-gray-700">
                This class has arms (e.g. A, B, C)
              </label>
            </div>

            {/* Arms Input */}
            {form.has_arms && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Arms
                </label>
                {arms.map((arm, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={arm}
                      onChange={(e) => handleArmChange(index, e.target.value)}
                      placeholder={`Arm ${index + 1} e.g. A`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                    />
                    {arms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveArm(index)}
                        className="text-red-400 hover:text-red-600 text-xs px-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddArm}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  + Add another arm
                </button>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim() || !form.section || (form.has_arms && arms.every(a => !a.trim()))}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingClass ? 'Update Class' : 'Add Class'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingClass(null) }}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes List */}
      {[{ label: 'Nursery Section', data: nurseryClasses }, { label: 'Primary Section', data: primaryClasses }].map(({ label, data }) => (
        <div key={label} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {label}
          </h2>

          {data.length === 0 && (
            <p className="text-gray-400 text-sm">No classes added yet.</p>
          )}

          <div className="space-y-3 max-w-2xl">
            {data.map((cls) => (
              <div
                key={cls.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                  cls.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">{cls.name}</span>
                    <span className="text-xs bg-blue-50 text-primary px-2 py-0.5 rounded-full">
                      {cls.section}
                    </span>
                    {cls.has_arms && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                        Has Arms
                      </span>
                    )}
                    {!cls.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(cls)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(cls)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                    >
                      {cls.is_active
                        ? <ToggleRight size={18} className="text-primary" />
                        : <ToggleLeft size={18} />
                      }
                    </button>
                    {cls.has_arms && (
                      <button
                        onClick={() => setExpanded(expanded === cls.id ? null : cls.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                      >
                        {expanded === cls.id
                          ? <ChevronUp size={16} />
                          : <ChevronDown size={16} />
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Arms */}
                {cls.has_arms && expanded === cls.id && (
                  <div className="border-t border-gray-100 px-6 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Arms
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cls.arms?.map((arm) => (
                        <div
                          key={arm.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                            arm.is_active
                              ? 'border-primary/20 bg-blue-50 text-primary'
                              : 'border-gray-200 bg-gray-50 text-gray-400'
                          }`}
                        >
                          <span className="font-medium">{cls.name} {arm.name}</span>
                          <button
                            onClick={() => handleToggleArmActive(arm)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {arm.is_active
                              ? <ToggleRight size={14} className="text-primary" />
                              : <ToggleLeft size={14} />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </AdminLayout>
  )
}

export default ClassList