import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { PlusCircle, Pencil, ToggleLeft, ToggleRight, Megaphone } from 'lucide-react'

const Announcements = () => {
  const { schoolId, user } = useAuthStore()
  const [announcements, setAnnouncements] = useState([])
  const [staffId, setStaffId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({ title: '', content: '' })

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*, staff(first_name, last_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
        setStaffId(data?.id || null)
      }
    if (schoolId) {
      fetchAll()
      fetchStaff()
    }
  }, [schoolId])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title: form.title,
            content: form.content,
            updated_at: new Date(),
          })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert([{
          school_id: schoolId,
          title: form.title,
          content: form.content,
          created_by: staffId || null,
          is_active: true,
        }])
        if (error) throw error
      }
      setSuccess(editing ? 'Announcement updated!' : 'Announcement posted!')
      setShowForm(false)
      setEditing(null)
      setForm({ title: '', content: '' })
      await fetchAll()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save announcement.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (announcement) => {
    setEditing(announcement)
    setForm({ title: announcement.title, content: announcement.content })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggle = async (announcement) => {
    await supabase
      .from('announcements')
      .update({ is_active: !announcement.is_active })
      .eq('id', announcement.id)
    await fetchAll()
  }

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading announcements...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">
            Post notices visible to all staff and parents.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditing(null)
            setForm({ title: '', content: '' })
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          New Announcement
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            {editing ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="e.g. School Reopening Date"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
                rows={5}
                placeholder="Type your announcement here..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition resize-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Post Announcement'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null) }}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-16 text-center">
          <Megaphone size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">No announcements yet.</p>
          <p className="text-gray-300 text-xs mt-1">
            Click "New Announcement" to post one.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {announcements.map(announcement => (
            <div
              key={announcement.id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                announcement.is_active
                  ? 'border-gray-100'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800 text-sm">
                        {announcement.title}
                      </h3>
                      {!announcement.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          Hidden
                        </span>
                      )}
                      {announcement.is_active && (
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-xs text-gray-400">
                        Posted by {announcement.staff?.first_name} {announcement.staff?.last_name}
                      </p>
                      <span className="text-gray-200">·</span>
                      <p className="text-xs text-gray-400">
                        {new Date(announcement.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleToggle(announcement)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                      title={announcement.is_active ? 'Hide' : 'Show'}
                    >
                      {announcement.is_active
                        ? <ToggleRight size={18} className="text-primary" />
                        : <ToggleLeft size={18} className="text-gray-400" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

export default Announcements