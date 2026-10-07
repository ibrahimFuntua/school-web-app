import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useTermStore } from '../../../store/termStore'
import { TERMS } from '../../../lib/constants'
import { CheckCircle, PlusCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const SessionManager = () => {
  const { schoolId, user } = useAuthStore()
  const { fetchCurrentTerm } = useTermStore()
  const [activeTab, setActiveTab] = useState('sessions')

  // Sessions & Terms state
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState(null)
  const [newSession, setNewSession] = useState('')
  const [addingSession, setAddingSession] = useState(false)
  const [termForms, setTermForms] = useState({})

  // Holidays state
  const [holidays, setHolidays] = useState([])
  const [staffId, setStaffId] = useState(null)
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    reason: '',
    holiday_type: 'Public Holiday',
    session_id: '',
    term_id: '',
  })
  const [holidayTerms, setHolidayTerms] = useState([])
  const [savingHoliday, setSavingHoliday] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSessions = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('*, terms(*)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from('school_holidays')
      .select('*, sessions(name), terms(name)')
      .eq('school_id', schoolId)
      .order('date', { ascending: false })
    setHolidays(data || [])
  }

  const fetchStaffId = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    setStaffId(data?.id || null)
  }

  useEffect(() => {
    if (schoolId) {
      fetchSessions()
      fetchHolidays()
      fetchStaffId()
    }
  }, [schoolId])

  // Load terms when holiday session changes
  useEffect(() => {
    const selected = sessions.find(s => s.id === holidayForm.session_id)
    setHolidayTerms(selected?.terms || [])
    setHolidayForm(f => ({ ...f, term_id: '' }))
  }, [holidayForm.session_id])

  // ---- SESSION HANDLERS ----
  const handleAddSession = async () => {
    if (!newSession.trim()) return
    setError('')
    setAddingSession(true)
    const { error } = await supabase
      .from('sessions')
      .insert([{ school_id: schoolId, name: newSession.trim(), is_current: false }])
    if (error) setError('Failed to add session.')
    else {
      setNewSession('')
      await fetchSessions()
    }
    setAddingSession(false)
  }

  const handleSetCurrentSession = async (sessionId) => {
    await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId)
    await supabase.from('sessions').update({ is_current: true }).eq('id', sessionId)
    setSuccess('Current session updated!')
    await fetchSessions()
    await fetchCurrentTerm(schoolId)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleAddTerm = async (sessionId) => {
    const form = termForms[sessionId]
    if (!form?.name) return
    const { error } = await supabase.from('terms').insert([{
      session_id: sessionId,
      name: form.name,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_current: false,
    }])
    if (error) setError('Failed to add term.')
    else {
      setTermForms({ ...termForms, [sessionId]: {} })
      await fetchSessions()
    }
  }

  const handleSetCurrentTerm = async (termId, sessionId) => {
    await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId)
    await supabase.from('sessions').update({ is_current: true }).eq('id', sessionId)
    await supabase.from('terms').update({ is_current: false }).in('session_id', sessions.map(s => s.id))
    await supabase.from('terms').update({ is_current: true }).eq('id', termId)
    setSuccess('Current term updated!')
    await fetchSessions()
    await fetchCurrentTerm(schoolId)
    setTimeout(() => setSuccess(''), 3000)
  }

  // ---- HOLIDAY HANDLERS ----
  const handleAddHoliday = async (e) => {
    e.preventDefault()
    setError('')
    setSavingHoliday(true)
    try {
      const { error } = await supabase.from('school_holidays').insert([{
        school_id: schoolId,
        date: holidayForm.date,
        reason: holidayForm.reason,
        holiday_type: holidayForm.holiday_type,
        session_id: holidayForm.session_id || null,
        term_id: holidayForm.term_id || null,
        created_by: staffId,
      }])
      if (error) throw error
      setSuccess('Holiday added!')
      setHolidayForm({ date: '', reason: '', holiday_type: 'Public Holiday', session_id: '', term_id: '' })
      await fetchHolidays()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to add holiday. Date may already exist.')
    } finally {
      setSavingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (id) => {
    await supabase.from('school_holidays').delete().eq('id', id)
    await fetchHolidays()
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Sessions & Terms</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage academic sessions, terms and school holidays.
        </p>
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['sessions', 'holidays'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition capitalize ${
              activeTab === tab
                ? 'bg-primary text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'sessions' ? 'Sessions & Terms' : 'School Holidays'}
          </button>
        ))}
      </div>

      {/* ---- SESSIONS TAB ---- */}
      {activeTab === 'sessions' && (
        <div>
          {/* Add Session */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Session</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newSession}
                onChange={(e) => setNewSession(e.target.value)}
                placeholder="e.g. 2025/2026"
                className={inputClass}
              />
              <button
                onClick={handleAddSession}
                disabled={addingSession}
                className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-60 whitespace-nowrap"
              >
                <PlusCircle size={16} />
                {addingSession ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Sessions List */}
          <div className="space-y-4 max-w-2xl">
            {sessions.length === 0 && (
              <p className="text-gray-400 text-sm">No sessions added yet.</p>
            )}
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    {session.is_current && <CheckCircle size={16} className="text-green-500" />}
                    <span className="font-semibold text-gray-800">{session.name}</span>
                    {session.is_current && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!session.is_current && (
                      <button
                        onClick={() => handleSetCurrentSession(session.id)}
                        className="text-xs text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition"
                      >
                        Set as Current
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                    >
                      {expandedSession === session.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {expandedSession === session.id && (
                  <div className="border-t border-gray-100 px-6 py-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Terms</p>
                    {session.terms?.length === 0 && (
                      <p className="text-gray-400 text-sm">No terms added yet.</p>
                    )}
                    
                    {session.terms?.map((term) => (
  <div key={term.id} className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 flex-wrap">
        {term.is_current && <CheckCircle size={14} className="text-green-500" />}
        <span className="text-sm font-medium text-gray-700">{term.name}</span>
        {term.start_date && (
          <span className="text-xs text-gray-400">
            {new Date(term.start_date).toLocaleDateString('en-GB')} — {new Date(term.end_date).toLocaleDateString('en-GB')}
          </span>
        )}
        {term.is_current && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
        )}
      </div>
      {!term.is_current && (
        <button
          onClick={() => handleSetCurrentTerm(term.id, session.id)}
          className="text-xs text-primary border border-primary px-3 py-1 rounded-lg hover:bg-primary hover:text-white transition"
        >
          Activate
        </button>
      )}
    </div>
    {/* Next Term Begins */}
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 whitespace-nowrap">
        Next Term Begins:
      </label>
      <input
        type="date"
        defaultValue={term.next_term_begins || ''}
        onBlur={async (e) => {
          if (e.target.value) {
            await supabase
              .from('terms')
              .update({ next_term_begins: e.target.value })
              .eq('id', term.id)
          }
        }}
        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary transition"
      />
    </div>
  </div>
))}

                    {session.terms?.length < 3 && (
                      <div className="pt-2 space-y-2">
                        <select
                          value={termForms[session.id]?.name || ''}
                          onChange={(e) => setTermForms({ ...termForms, [session.id]: { ...termForms[session.id], name: e.target.value } })}
                          className={inputClass}
                        >
                          <option value="">Select Term</option>
                          {TERMS.filter(t => !session.terms?.find(st => st.name === t)).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={termForms[session.id]?.start_date || ''}
                            onChange={(e) => setTermForms({ ...termForms, [session.id]: { ...termForms[session.id], start_date: e.target.value } })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                          />
                          <input
                            type="date"
                            value={termForms[session.id]?.end_date || ''}
                            onChange={(e) => setTermForms({ ...termForms, [session.id]: { ...termForms[session.id], end_date: e.target.value } })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                          />
                        </div>
                        <button
                          onClick={() => handleAddTerm(session.id)}
                          className="flex items-center gap-2 text-sm bg-accent hover:bg-accent-dark text-white font-semibold px-4 py-2 rounded-lg transition"
                        >
                          <PlusCircle size={14} />
                          Add Term
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- HOLIDAYS TAB ---- */}
      {activeTab === 'holidays' && (
        <div className="max-w-2xl">
          {/* Add Holiday Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Declare a Holiday
            </h2>
            <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Type <span className="text-red-500">*</span></label>
                <select
                  value={holidayForm.holiday_type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, holiday_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="Public Holiday">Public Holiday</option>
                  <option value="School Holiday">School Holiday</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={holidayForm.reason}
                  onChange={(e) => setHolidayForm({ ...holidayForm, reason: e.target.value })}
                  required
                  placeholder="e.g. Independence Day, Founder's Day"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
                <select
                  value={holidayForm.session_id}
                  onChange={(e) => setHolidayForm({ ...holidayForm, session_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select Session</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  value={holidayForm.term_id}
                  onChange={(e) => setHolidayForm({ ...holidayForm, term_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select Term</option>
                  {holidayTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60"
                >
                  {savingHoliday ? 'Saving...' : 'Declare Holiday'}
                </button>
              </div>
            </form>
          </div>

          {/* Holidays List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Term</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {holidays.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-400">
                        No holidays declared yet.
                      </td>
                    </tr>
                  )}
                  {holidays.map((holiday) => (
                    <tr key={holiday.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {new Date(holiday.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{holiday.reason}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          holiday.holiday_type === 'Public Holiday'
                            ? 'bg-blue-50 text-primary'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {holiday.holiday_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{holiday.terms?.name || '—'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default SessionManager