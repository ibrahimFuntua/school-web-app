import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Printer } from 'lucide-react'
import { fetchAllRows, loadOutstanding } from '../../../lib/feeUtils'

const money = (n) => `₦${Number(n || 0).toLocaleString()}`

// For the proprietor: how much each section owes and has paid, and how much each person received.
const FeeSummary = () => {
  const { schoolId, schoolName } = useAuthStore()
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('') // '' = every term of the session
  const [bySection, setBySection] = useState([])
  const [byPerson, setByPerson] = useState([])
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
        const [sectionRes, leaderRes, bills, payments] = await Promise.all([
          supabase.from('school_sections')
            .select('id, name, managed_by, order_number')
            .eq('school_id', schoolId).order('order_number'),
          supabase.from('staff')
            .select('first_name, last_name, role')
            .eq('school_id', schoolId).in('role', ['Head Teacher', 'Principal']),
          loadOutstanding({ schoolId, sessionId, termId }),
          fetchAllRows(() => {
            let q = supabase.from('payments')
              .select('amount_paid, received_by, students(section), staff!received_by(first_name, last_name, role)')
              .eq('school_id', schoolId).eq('is_void', false).eq('session_id', sessionId)
            if (termId) q = q.eq('term_id', termId)
            return q.order('id')
          }),
        ])

        const leaders = leaderRes.data || []

        // By section
        const sectionRows = (sectionRes.data || []).map(sec => {
          const students = bills.rows.filter(r => r.student.section === sec.name)
          const collected = payments
            .filter(p => p.students?.section === sec.name)
            .reduce((s, p) => s + Number(p.amount_paid || 0), 0)
          const names = leaders
            .filter(l => l.role === sec.managed_by)
            .map(l => `${l.first_name} ${l.last_name}`)
          return {
            id: sec.id,
            name: sec.name,
            managedBy: sec.managed_by || 'Admin only',
            person: names.join(', '),
            billed: students.reduce((s, r) => s + r.charged, 0),
            collected,
            owed: students.reduce((s, r) => s + r.owed, 0),
          }
        })
        setBySection(sectionRows)

        // By person: who actually received the money
        const people = {}
        payments.forEach(p => {
          const key = p.received_by || 'admin'
          if (!people[key]) {
            people[key] = {
              key,
              name: p.staff ? `${p.staff.first_name} ${p.staff.last_name}` : 'Admin',
              position: p.staff?.role || 'Admin',
              receipts: 0,
              total: 0,
            }
          }
          people[key].receipts += 1
          people[key].total += Number(p.amount_paid || 0)
        })
        setByPerson(Object.values(people).sort((a, b) => b.total - a.total))
      } catch (err) {
        setError(`Could not load the summary: ${err.message}`)
        setBySection([])
        setByPerson([])
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

  const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0)
  const selectClass = "px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const th = "px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"

  return (
    <AdminLayout>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #summary-print-area, #summary-print-area * { visibility: visible; }
          #summary-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Fee Summary</h1>
          <p className="text-gray-500 text-sm mt-1">
            How much each section owes and has paid, and how much each person has received.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium px-4 py-2.5 rounded-lg transition text-sm"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={sessionId} onChange={handleSessionChange} className={selectClass}>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className={selectClass}>
          <option value="">All terms so far</option>
          {sessionTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div id="summary-print-area" className="space-y-6">
        <div className="hidden print:block text-sm font-semibold text-gray-700">
          {schoolName} — Fee Summary
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">By section</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className={`text-left ${th}`}>Section</th>
                  <th className={`text-left ${th}`}>Responsible</th>
                  <th className={`text-right ${th}`}>Billed</th>
                  <th className={`text-right ${th}`}>Collected</th>
                  <th className={`text-right ${th}`}>Still owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400 animate-pulse">Working it out...</td></tr>
                )}
                {!loading && bySection.map(r => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 font-medium text-gray-800">{r.name}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {r.managedBy}
                      {r.person && <span className="text-xs text-gray-400"> · {r.person}</span>}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">{money(r.billed)}</td>
                    <td className="px-6 py-3 text-right text-green-600 font-medium">{money(r.collected)}</td>
                    <td className="px-6 py-3 text-right text-amber-600 font-medium">{money(r.owed)}</td>
                  </tr>
                ))}
                {!loading && bySection.length > 0 && (
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-3" colSpan={2}>Whole school</td>
                    <td className="px-6 py-3 text-right">{money(sum(bySection, 'billed'))}</td>
                    <td className="px-6 py-3 text-right text-green-700">{money(sum(bySection, 'collected'))}</td>
                    <td className="px-6 py-3 text-right text-amber-700">{money(sum(bySection, 'owed'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Money received, by person</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className={`text-left ${th}`}>Received by</th>
                  <th className={`text-left ${th}`}>Position</th>
                  <th className={`text-right ${th}`}>Receipts</th>
                  <th className={`text-right ${th}`}>Total received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!loading && byPerson.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">No payments for this selection.</td></tr>
                )}
                {!loading && byPerson.map(r => (
                  <tr key={r.key}>
                    <td className="px-6 py-3 font-medium text-gray-800">{r.name}</td>
                    <td className="px-6 py-3 text-gray-600">{r.position}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{r.receipts}</td>
                    <td className="px-6 py-3 text-right text-green-600 font-medium">{money(r.total)}</td>
                  </tr>
                ))}
                {!loading && byPerson.length > 0 && (
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-3" colSpan={2}>Total</td>
                    <td className="px-6 py-3 text-right">{sum(byPerson, 'receipts')}</td>
                    <td className="px-6 py-3 text-right text-green-700">{money(sum(byPerson, 'total'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Billed and still owed count compulsory fees only. Collected counts every receipt, including optional fees.
          Voided receipts are left out. A payment recorded by the Admin shows as "Admin".
        </p>
      </div>
    </AdminLayout>
  )
}

export default FeeSummary