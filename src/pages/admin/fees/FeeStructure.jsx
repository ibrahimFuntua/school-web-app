import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useSections } from '../../../hooks/useSections'
import { PlusCircle, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

const FeeStructure = () => {
  const { schoolId } = useAuthStore()
  const { sections } = useSections()
  const [fees, setFees] = useState([])
  const [sessions, setSessions] = useState([])

  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingFee, setEditingFee] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    amount: '',
    section: '',
    class_id: '',
    session_id: '',
    term_id: '',
    fee_type: 'Compulsory',
  })

  const fetchAll = async () => {
    setLoading(true)
    const [feesRes, sessionsRes, classesRes] = await Promise.all([
      supabase.from('fees').select('*, sessions(name), terms(name), classes(name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*, terms(*)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('classes').select('*').eq('school_id', schoolId).eq('is_active', true).order('name'),
    ])
    setFees(feesRes.data || [])
    setSessions(sessionsRes.data || [])
    setClasses(classesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchAll()
  }, [schoolId])

  // The terms that belong to the session picked in the form
  const terms = sessions.find(s => s.id === form.session_id)?.terms || []

  const handleChange = (e) => {
    const { name, value } = e.target
    const next = { ...form, [name]: value }
    if (name === 'session_id') next.term_id = ''  // terms belong to a session
    if (name === 'section') next.class_id = ''    // classes belong to a section
    setForm(next)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        name: form.name,
        amount: parseFloat(form.amount),
        section: form.section || null,
        class_id: form.class_id || null,
        session_id: form.session_id || null,
        term_id: form.term_id || null,
        fee_type: form.fee_type,
        school_id: schoolId,
    }

      if (editingFee) {
        const { error } = await supabase
          .from('fees')
          .update({ ...payload, updated_at: new Date() })
          .eq('id', editingFee.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('fees')
          .insert([payload])
        if (error) throw error
      }

      setSuccess(editingFee ? 'Fee updated!' : 'Fee added!')
      setShowForm(false)
      setEditingFee(null)
      setForm({ name: '', amount: '', section: '', class_id: '', session_id: '', term_id: '', fee_type: 'Compulsory' })
      await fetchAll()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to save fee. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (fee) => {
    setEditingFee(fee)
    setForm({
      name: fee.name,
      amount: fee.amount,
      section: fee.section || '',
      class_id: fee.class_id || '',
      session_id: fee.session_id || '',
      term_id: fee.term_id || '',
      fee_type: fee.fee_type,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleActive = async (fee) => {
    await supabase
      .from('fees')
      .update({ is_active: !fee.is_active })
      .eq('id', fee.id)
    await fetchAll()
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading fees...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Fee Structure</h1>
          <p className="text-gray-500 text-sm mt-1">
            Define and manage all fee types.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingFee(null)
            setForm({ name: '', amount: '', section: '', class_id: '', session_id: '', term_id: '', fee_type: 'Compulsory' })
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          <PlusCircle size={16} />
          Add Fee
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
            {editingFee ? 'Edit Fee' : 'New Fee'}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Fee Name <span className="text-red-500">*</span></label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. School Fees, PTA Levy"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Amount (₦) <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                placeholder="e.g. 25000"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Fee Type</label>
              <select name="fee_type" value={form.fee_type} onChange={handleChange} className={inputClass}>
                <option value="Compulsory">Compulsory</option>
                <option value="Optional">Optional</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Section</label>
              <select name="section" value={form.section} onChange={handleChange} className={inputClass}>
                <option value="">All Sections</option>
                {sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Specific Class <span className="text-xs text-gray-400">(optional)</span></label>
              <select name="class_id" value={form.class_id} onChange={handleChange} className={inputClass}>
                <option value="">All Classes</option>
                {classes.filter(c => !form.section || c.section === form.section).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Session <span className="text-red-500">*</span></label>
              <select name="session_id" value={form.session_id} onChange={handleChange} required className={inputClass}>
                <option value="">Select Session</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Term</label>
              <select name="term_id" value={form.term_id} onChange={handleChange} className={inputClass}>
                <option value="">Every term (charged each term)</option>
                {terms.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingFee ? 'Update Fee' : 'Add Fee'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingFee(null) }}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fees Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-5xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Section</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Term</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    No fees defined yet.
                  </td>
                </tr>
              )}
              {fees.map((fee) => (
                <tr key={fee.id} className={`hover:bg-gray-50 transition ${!fee.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 font-medium text-gray-800">{fee.name}</td>
                  <td className="px-6 py-4 text-gray-700 font-semibold">
                    ₦{Number(fee.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{fee.section || 'All'}</td>
                  <td className="px-6 py-4 text-gray-500">{fee.classes?.name || 'All'}</td>
                  <td className="px-6 py-4 text-gray-500">{fee.sessions?.name || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{fee.terms?.name || 'Every term'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      fee.fee_type === 'Compulsory'
                        ? 'bg-blue-50 text-primary'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {fee.fee_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(fee)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(fee)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                      >
                        {fee.is_active
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

export default FeeStructure