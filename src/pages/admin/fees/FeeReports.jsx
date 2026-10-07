import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Search, Printer, X } from 'lucide-react'

const ReceiptModal = ({ payment, onClose }) => {
  if (!payment) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 20px;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">

          {/* Modal Header — fixed at top */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-sm font-bold text-gray-700">Payment Receipt</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
            >
              <X size={16} />
            </button>
          </div>

          {/* Receipt Content — scrollable */}
          <div className="overflow-y-auto flex-1 px-6 py-5" id="receipt-print-area">
            <div className="space-y-4">

              {/* School Header */}
              <div className="text-center border-b border-dashed border-gray-200 pb-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold text-sm">NCC</span>
                </div>
                <h3 className="font-bold text-primary text-base">
                  NCC School Management
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Official Payment Receipt
                </p>
              </div>

              {/* Receipt Details */}
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Receipt No.</span>
                  <span className="font-semibold text-gray-800 font-mono">
                    {payment.receipt_number}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-800">
                    {new Date(payment.payment_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <div className="border-t border-dashed border-gray-100 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Student Name</span>
                  <span className="font-medium text-gray-800">
                    {payment.students?.first_name} {payment.students?.last_name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Admission No.</span>
                  <span className="font-medium text-gray-800">
                    {payment.students?.admission_number}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Class</span>
                  <span className="font-medium text-gray-800">
                    {payment.students?.classes?.name}
                  </span>
                </div>
                <div className="border-t border-dashed border-gray-100 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Fee</span>
                  <span className="font-medium text-gray-800">
                    {payment.fees?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Session</span>
                  <span className="font-medium text-gray-800">
                    {payment.sessions?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Term</span>
                  <span className="font-medium text-gray-800">
                    {payment.terms?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="font-medium text-gray-800">
                    {payment.payment_method}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Received By</span>
                  <span className="font-medium text-gray-800">
                    {payment.staff?.first_name} {payment.staff?.last_name}
                  </span>
                </div>
                <div className="border-t border-dashed border-gray-100 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-bold text-green-700 text-base">
                    ₦{Number(payment.amount_paid).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Balance</span>
                  <span className={`font-bold text-base ${
                    Number(payment.balance) === 0
                      ? 'text-green-600'
                      : 'text-amber-600'
                  }`}>
                    ₦{Number(payment.balance).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    payment.payment_status === 'Full'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {payment.payment_status}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-dashed border-gray-200 pt-3 text-center">
                <p className="text-xs text-gray-400">Thank you for your payment!</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  This is an official receipt — keep it safe.
                </p>
              </div>

            </div>
          </div>

          {/* Actions — fixed at bottom */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              <Printer size={15} />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

const FeeReports = () => {
  const { schoolId } = useAuthStore()
  const [payments, setPayments] = useState([])
  const [sessions, setSessions] = useState([])
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [filterTerm, setFilterTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [selectedPayment, setSelectedPayment] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    const [paymentsRes, sessionsRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, students(first_name, last_name, admission_number, classes(name)), fees(name), sessions(name), terms(name), staff(first_name, last_name)')
        .eq('school_id', schoolId)
        .order('payment_date', { ascending: false }),
      supabase
        .from('sessions')
        .select('*, terms(*)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
    ])
    setPayments(paymentsRes.data || [])
    setSessions(sessionsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (schoolId) fetchAll()
  }, [schoolId])

  useEffect(() => {
    const selected = sessions.find(s => s.id === filterSession)
    setTerms(selected?.terms || [])
    setFilterTerm('')
  }, [filterSession])

  const filtered = payments.filter(p => {
    const name = `${p.students?.first_name} ${p.students?.last_name}`.toLowerCase()
    const matchSearch =
      name.includes(search.toLowerCase()) ||
      p.students?.admission_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.receipt_number?.toLowerCase().includes(search.toLowerCase())
    const matchSession = !filterSession || p.session_id === filterSession
    const matchTerm = !filterTerm || p.term_id === filterTerm
    const matchStatus = filterStatus === 'All' || p.payment_status === filterStatus
    return matchSearch && matchSession && matchTerm && matchStatus
  })

  const totalCollected = filtered.reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const totalBalance = filtered.reduce((sum, p) => sum + Number(p.balance), 0)

  if (loading) return (
    <AdminLayout>
      <p className="text-gray-400 animate-pulse">Loading reports...</p>
    </AdminLayout>
  )

  return (
    <AdminLayout>

      {/* Receipt Modal */}
      {selectedPayment && (
        <ReceiptModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Fee Reports</h1>
        <p className="text-gray-500 text-sm mt-1">
          Click any payment row to view and print its receipt.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Total Payments</p>
          <p className="text-2xl font-bold text-primary">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">
            ₦{totalCollected.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold text-amber-600">
            ₦{totalBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or receipt no..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
        <select
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="">All Sessions</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="">All Terms</option>
          {terms.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          {['All', 'Full', 'Part Payment'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt No.</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount Paid</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No payment records found.
                  </td>
                </tr>
              )}
              {filtered.map((payment) => (
                <tr
                  key={payment.id}
                  onClick={() => setSelectedPayment(payment)}
                  className="hover:bg-blue-50 transition cursor-pointer"
                >
                  <td className="px-6 py-4 text-xs font-mono text-gray-500">
                    {payment.receipt_number}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">
                      {payment.students?.first_name} {payment.students?.last_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {payment.students?.admission_number}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{payment.fees?.name}</td>
                  <td className="px-6 py-4 font-semibold text-green-700">
                    ₦{Number(payment.amount_paid).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-amber-600">
                    ₦{Number(payment.balance).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(payment.payment_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      payment.payment_status === 'Full'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {payment.payment_status}
                    </span>
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

export default FeeReports