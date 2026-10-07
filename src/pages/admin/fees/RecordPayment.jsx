import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Search, PrinterIcon } from 'lucide-react'
import { PAYMENT_METHODS } from '../../../lib/constants'

const RecordPayment = () => {
    const { schoolId, user } = useAuthStore()
    const [fees, setFees] = useState([])
    const [sessions, setSessions] = useState([])
    const [terms, setTerms] = useState([])
    const [staffId, setStaffId] = useState(null)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(null)
    const [error, setError] = useState('')

    // Student search
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [searching, setSearching] = useState(false)

    const [form, setForm] = useState({
        fee_id: '',
        amount_paid: '',
        payment_date: new Date().toLocaleDateString('en-GB'),
        payment_method: '',
        session_id: '',
        term_id: '',
    })

    // Fee balance calculation
    const [feeAmount, setFeeAmount] = useState(0)
    const [balance, setBalance] = useState(0)
    const [previouslyPaid, setPreviouslyPaid] = useState(0)

    useEffect(() => {
        const fetchData = async () => {
            const [feesRes, sessionsRes, staffRes] = await Promise.all([
            supabase.from('fees').select('*').eq('school_id', schoolId).eq('is_active', true),
            supabase.from('sessions').select('*, terms(*)').eq('school_id', schoolId).order('created_at', { ascending: false }),
            supabase.from('staff').select('id').eq('auth_user_id', user.id).single(),
            ])
            setFees(feesRes.data || [])
            setSessions(sessionsRes.data || [])
            setStaffId(staffRes.data?.id || null)
        }
        if (schoolId) fetchData()
    }, [schoolId])

    // Load terms when session changes
    useEffect(() => {
        const selected = sessions.find(s => s.id === form.session_id)
        setTerms(selected?.terms || [])
        setForm(f => ({ ...f, term_id: '' }))
    }, [form.session_id])

    // Calculate balance when fee or amount changes
    useEffect(() => {
  const fetchPreviousPayments = async () => {
    const selected = fees.find(f => f.id === form.fee_id)
    if (!selected) return

    setFeeAmount(selected.amount)

    if (selectedStudent) {
      // Fetch previous payments for this student + fee
      const { data: prev } = await supabase
        .from('payments')
        .select('amount_paid')
        .eq('student_id', selectedStudent.id)
        .eq('fee_id', form.fee_id)

      const previouslyPaid = prev?.reduce(
        (sum, p) => sum + Number(p.amount_paid), 0
      ) || 0

      const currentInput = parseFloat(form.amount_paid) || 0
      const remaining = Math.max(0, selected.amount - previouslyPaid - currentInput)
      setBalance(remaining)

      // Show previously paid info
      setPreviouslyPaid(previouslyPaid)
    }
  }
  fetchPreviousPayments()
}, [form.fee_id, form.amount_paid, selectedStudent])

    const handleSearch = async () => {
        if (!searchQuery.trim()) return
        setSearching(true)
        const { data } = await supabase
        .from('students')
        .select('*, classes(name), arms(name)')
        .eq('school_id', schoolId)
        .eq('status', 'Active')
        .or(`admission_number.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(5)

        setSearchResults(data || [])
        setSearching(false)
    }

    const handleSelectStudent = (student) => {
        setSelectedStudent(student)
        setSearchResults([])
        setSearchQuery('')
    }

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    // Parse dd/mm/yyyy to ISO date for storage
    const parseDate = (dateStr) => {
        const [day, month, year] = dateStr.split('/')
        return `${year}-${month}-${day}`
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedStudent) {
        setError('Please select a student first.')
        return
    }
    setError('')
    setSaving(true)

    try {
        const { data: receiptNumber } = await supabase
        .rpc('generate_receipt_number', { p_school_id: schoolId })

        const amountPaid = parseFloat(form.amount_paid)

    // Fetch all previous payments for this student + this fee
    const { data: previousPayments } = await supabase
    .from('payments')
    .select('amount_paid')
    .eq('student_id', selectedStudent.id)
    .eq('fee_id', form.fee_id)

    // Calculate total paid so far including this payment
    const previouslyPaid = previousPayments?.reduce(
        (sum, p) => sum + Number(p.amount_paid), 0
    ) || 0

    const totalPaidSoFar = previouslyPaid + amountPaid
    const remainingBalance = Math.max(0, feeAmount - totalPaidSoFar)
    const paymentStatus = remainingBalance === 0 ? 'Full' : 'Part Payment'

    const { error: payError } = await supabase
    .from('payments')
    .insert([{
        school_id: schoolId,
        fee_id: form.fee_id,
        student_id: selectedStudent.id,
        student_system_id: selectedStudent.admission_number,
        amount_paid: amountPaid,
        balance: remainingBalance,
        payment_date: parseDate(form.payment_date),
        payment_method: form.payment_method,
        payment_status: paymentStatus,
        receipt_number: receiptNumber,
        received_by: staffId,
        session_id: form.session_id || null,
        term_id: form.term_id || null,
    }])

    if (payError) throw payError

    setSuccess({
        receipt: receiptNumber,
        student: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        amount: amountPaid,
        totalPaid: totalPaidSoFar,
        balance: remainingBalance,
        status: paymentStatus,
        date: form.payment_date,
    })

    // Reset form
    setSelectedStudent(null)
    setForm({
        fee_id: '',
        amount_paid: '',
        payment_date: new Date().toLocaleDateString('en-GB'),
        payment_method: '',
        session_id: '',
        term_id: '',
    })
    setFeeAmount(0)
    setBalance(0)
} catch (err) {
    setError('Failed to record payment. Please try again.')
} finally {
    setSaving(false)
}
}

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Record Payment</h1>
        <p className="text-gray-500 text-sm mt-1">
          Record a fee payment for a student.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 max-w-2xl">
          {error}
        </div>
      )}

      {/* Receipt Preview */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-green-700">Payment Recorded Successfully!</h2>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 text-xs text-green-700 border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
            >
              <PrinterIcon size={13} />
              Print Receipt
            </button>
          </div>
          <div className="space-y-1 text-sm text-green-800">
            <p><span className="font-medium">Receipt No:</span> {success.receipt}</p>
            <p><span className="font-medium">Student:</span> {success.student}</p>
            <p><span className="font-medium">Amount Paid (This Payment):</span> ₦{Number(success.amount).toLocaleString()}</p>
            <p><span className="font-medium">Total Paid So Far:</span> ₦{Number(success.totalPaid).toLocaleString()}</p>
            <p><span className="font-medium">Remaining Balance:</span> ₦{Number(success.balance).toLocaleString()}</p>
            <p><span className="font-medium">Status:</span> {success.status}</p>
            <p><span className="font-medium">Date:</span> {success.date}</p>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="mt-4 text-xs text-green-700 underline"
          >
            Record another payment
          </button>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

          {/* Student Search */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Find Student
            </h2>

            {selectedStudent ? (
              <div className="flex items-center justify-between bg-blue-50 border border-primary/20 rounded-lg px-4 py-3">
                <div>
                  <p className="font-semibold text-primary text-sm">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedStudent.admission_number} · {selectedStudent.classes?.name}
                    {selectedStudent.arms?.name ? ` ${selectedStudent.arms.name}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search by name or admission number..."
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching}
                    className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium transition hover:bg-primary-light disabled:opacity-60"
                  >
                    {searching ? '...' : 'Search'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                    {searchResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {student.admission_number} · {student.classes?.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
              Payment Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="sm:col-span-2">
                <label className={labelClass}>Fee <span className="text-red-500">*</span></label>
                <select name="fee_id" value={form.fee_id} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Fee</option>
                  {fees.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} — ₦{Number(f.amount).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {feeAmount > 0 && (
  <div className="sm:col-span-2 space-y-2">
    <div className="bg-blue-50 border border-primary/10 rounded-lg px-4 py-3 text-sm text-primary">
      Fee Amount: <span className="font-bold">₦{Number(feeAmount).toLocaleString()}</span>
    </div>
    {previouslyPaid > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
        Previously Paid: <span className="font-bold">₦{Number(previouslyPaid).toLocaleString()}</span>
        {' '}— Remaining: <span className="font-bold">₦{Number(feeAmount - previouslyPaid).toLocaleString()}</span>
      </div>
    )}
  </div>
)}

              <div>
                <label className={labelClass}>Amount Paid (₦) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="amount_paid"
                  value={form.amount_paid}
                  onChange={handleChange}
                  required
                  placeholder="Enter amount"
                  className={inputClass}
                />
              </div>

              {form.amount_paid && feeAmount > 0 && (
                <div className="flex items-end pb-1">
                  <div className={`w-full rounded-lg px-4 py-3 text-sm font-medium ${
                    balance === 0
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {balance === 0
                      ? '✅ Full Payment'
                      : `Balance: ₦${Number(balance).toLocaleString()}`
                    }
                  </div>
                </div>
              )}

              <div>
                <label className={labelClass}>Payment Date <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="payment_date"
                  value={form.payment_date}
                  onChange={handleChange}
                  required
                  placeholder="dd/mm/yyyy"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Payment Method <span className="text-red-500">*</span></label>
                <select name="payment_method" value={form.payment_method} onChange={handleChange} required className={inputClass}>
                  <option value="">Select Method</option>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Session</label>
                <select name="session_id" value={form.session_id} onChange={handleChange} className={inputClass}>
                  <option value="">Select Session</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Term</label>
                <select name="term_id" value={form.term_id} onChange={handleChange} className={inputClass}>
                  <option value="">Select Term</option>
                  {terms.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          <div className="flex gap-3 pb-8">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary-light text-white font-semibold px-8 py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  )
}

export default RecordPayment