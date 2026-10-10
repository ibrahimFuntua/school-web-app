import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Search, Printer } from 'lucide-react'
import { loadOutstanding } from '../../../lib/feeUtils'

const OutstandingFees = () => {
  const { schoolId, schoolName } = useAuthStore()
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('') // '' = every term that has started
  const [rows, setRows] = useState([])
  const [classFilter, setClassFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sessionTerms = sessions.find(s => s.id === sessionId)?.terms || []

  // Start on the current session and term
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*, terms(*)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
      const list = data || []
      setSessions(list)
      const current = list.find(s => s.is_current) || list[0]
      if (current) {
        setSessionId(current.id)
        setTermId((current.terms || []).find(t => t.is_current)?.id || '')
      } else {
        setLoading(false)
      }
    }
    if (schoolId) init()
  }, [schoolId])

  useEffect(() => {
    if (!sessionId) return
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await loadOutstanding({ schoolId, sessionId, termId })
        setRows(result.rows)
      } catch (err) {
        setError(`Could not load the list: ${err.message}`)
        setRows([])
      }
      setLoading(false)
    }
    run()
  }, [sessionId, termId])

  const handleSessionChange = (e) => {
    const picked = sessions.find(s => s.id === e.target.value)
    setSessionId(e.target.value)
    setTermId((picked?.terms || []).find(t => t.is_current)?.id || '')
  }

  const classOptions = Array.from(
    new Map(
      rows.filter(r => r.student.class_id).map(r => [r.student.class_id, r.student.classes?.name || 'Class'])
    ).entries()
  )

  const inClass = rows.filter(r => !classFilter || r.student.class_id === classFilter)
  const owing = inClass
    .filter(r => r.owed > 0)
    .filter(r => {
      const q = search.toLowerCase()
      const name = `${r.student.first_name} ${r.student.last_name}`.toLowerCase()
      return !q || name.includes(q) || r.student.admission_number?.toLowerCase().includes(q)
    })
    .sort((a, b) =>
      (a.student.classes?.name || '').localeCompare(b.student.classes?.name || '') ||
      (a.student.last_name || '').localeCompare(b.student.last_name || '')
    )

  const totalOwed = owing.reduce((s, r) => s + r.owed, 0)
  const totalBilled = inClass.reduce((s, r) => s + r.charged, 0)
  const totalPaid = inClass.reduce((s, r) => s + r.paid, 0)

  const money = (n) => `₦${Number(n).toLocaleString()}`
  const selectClass = "px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"

  return (
    <AdminLayout>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #owing-print-area, #owing-print-area * { visibility: visible; }
          #owing-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Outstanding Fees</h1>
          <p className="text-gray-500 text-sm mt-1">
            Every student who still owes compulsory fees, including those who have not paid anything yet.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium px-4 py-2.5 rounded-lg transition text-sm"
        >
          <Printer size={15} />
          Print list
        </button>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <select value={sessionId} onChange={handleSessionChange} className={selectClass}>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={selectClass}>
          <option value="">All terms so far</option>
          {sessionTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={selectClass}>
          <option value="">All classes</option>
          {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or admission no..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Students owing</p>
          <p className="text-2xl font-bold text-primary">{owing.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Total owed</p>
          <p className="text-2xl font-bold text-amber-600">{money(totalOwed)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Total billed</p>
          <p className="text-2xl font-bold text-gray-700">{money(totalBilled)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Collected</p>
          <p className="text-2xl font-bold text-green-600">{money(totalPaid)}</p>
        </div>
      </div>

      <div id="owing-print-area" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="hidden print:block px-6 pt-4 text-sm font-semibold text-gray-700">
          {schoolName} — Outstanding Fees
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">What is owed</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400 animate-pulse">Working it out...</td></tr>
              )}
              {!loading && owing.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">
                    {rows.length === 0
                      ? 'No compulsory fees are set up for this session yet.'
                      : 'Nobody owes anything for this selection.'}
                  </td>
                </tr>
              )}
              {!loading && owing.map(r => (
                <tr key={r.student.id}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{r.student.first_name} {r.student.last_name}</p>
                    <p className="text-xs text-gray-400">{r.student.admission_number}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {r.student.classes?.name}{r.student.arms?.name ? ` ${r.student.arms.name}` : ''}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 space-y-0.5">
                    {r.items.filter(i => i.owed > 0).map(i => (
                      <p key={`${i.fee.id}-${i.term.id}`}>
                        {i.fee.name}{i.fee.term_id ? '' : ` (${i.term.name})`}: {money(i.owed)}
                        {i.paid > 0 && <span className="text-gray-400"> — paid {money(i.paid)} of {money(i.charged)}</span>}
                      </p>
                    ))}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-amber-600">{money(r.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}

export default OutstandingFees