import { useEffect, useState } from 'react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { Search, PrinterIcon } from 'lucide-react'
import { PAYMENT_METHODS } from '../../../lib/constants'
import { feeAppliesToStudent } from '../../../lib/feeUtils'

const RecordPayment = () => {
    const { schoolId, user } = useAuthStore()
    const [fees, setFees] = useState([])
    const [sessions, setSessions] = useState([])
    const [staffId, setStaffId] = useState(null)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(null)
    const [error, setError] = useState('')

    // Student search
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [searching, setSearching] = useState(false)

    const todayIso = () => new Date().toISOString().split('T')[0]

    const [form, setForm] = useState({
        fee_id: '',
        amount_paid: '',
        payment_date: todayIso(),
        payment_method: '',
        term_id: '',
    })

    // How much has already been paid on this fee (in this term, for an every-term fee)
    const [previouslyPaid, setPreviouslyPaid] = useState(0)

    useEffect(() => {
        const fetchData = async () => {
            const [feesRes, sessionsRes, staffRes] = await Promise.all([
                supabase.from('fees').select('*').eq('school_id', schoolId).eq('is_active', true),
                supabase.from('sessions').select('*, terms(*)').eq('school_id', schoolId).order('created_at', { ascending: false }),
                supabase.from('staff').select('id').eq('auth_user_id', user.id).maybeSingle(),
            ])
            setFees(feesRes.data || [])
            setSessions(sessionsRes.data || [])
            setStaffId(staffRes.data?.id || null)
        }
        if (schoolId) fetchData()
    }, [schoolId])

    // Everything below is worked out from the student, the fee and the term
    const selectedFee = fees.find(f => f.id === form.fee_id) || null
    const feeSession = sessions.find(s => s.id === selectedFee?.session_id) || null
    const feeTerms = feeSession?.terms || []
    // A fee for one term is always paid in that term; an every-term fee is paid term by term
    const effectiveTermId = selectedFee?.term_id || form.term_id || ''
    const feeAmount = selectedFee ? Number(selectedFee.amount) : 0
    const enteredAmount = parseFloat(form.amount_paid) || 0
    const remainingBefore = Math.max(0, feeAmount - previouslyPaid)
    const balance = Math.max(0, remainingBefore - enteredAmount)
    const overpaying = !!selectedFee && enteredAmount > remainingBefore

    // Only the fees that apply to this student's section and class
    const applicableFees = selectedStudent ? fees.filter(f => feeAppliesToStudent(f, selectedStudent)) : []

    const feeLabel = (f) => {
        const session = sessions.find(s => s.id === f.session_id)
        const term = f.term_id ? (session?.terms || []).find(t => t.id === f.term_id) : null
        return `${f.name} — ₦${Number(f.amount).toLocaleString()} (${session?.name || 'No session'}, ${term ? term.name : 'every term'})`
    }

    // When a fee is picked, fill in its term: the fee's own term, or the current term
    useEffect(() => {
        if (!selectedFee) { setForm(f => ({ ...f, term_id: '' })); return }
        if (selectedFee.term_id) { setForm(f => ({ ...f, term_id: selectedFee.term_id })); return }
        const current = (sessions.find(s => s.id === selectedFee.session_id)?.terms || []).find(t => t.is_current)
        setForm(f => ({ ...f, term_id: current?.id || '' }))
    }, [form.fee_id])

    // Money already paid on this fee (voided payments never count)
    const fetchPaid = async (student, fee, termId) => {
        let q = supabase
            .from('payments')
            .select('amount_paid')
            .eq('student_id', student.id)
            .eq('fee_id', fee.id)
            .eq('is_void', false)
        if (!fee.term_id) q = termId ? q.eq('term_id', termId) : q.is('term_id', null)
        const { data, error: paidError } = await q
        if (paidError) throw paidError
        return (data || []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
    }

    useEffect(() => {
        const load = async () => {
            if (!selectedFee || !selectedStudent) { setPreviouslyPaid(0); return }
            try {
                setPreviouslyPaid(await fetchPaid(selectedStudent, selectedFee, effectiveTermId))
            } catch (err) {
                setPreviouslyPaid(0)
            }
        }
        load()
    }, [form.fee_id, form.term_id, selectedStudent])

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
        setForm(f => ({ ...f, fee_id: '', term_id: '' }))
    }

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedStudent) { setError('Please select a student first.'); return }
        if (!selectedFee) { setError('Please select a fee.'); return }
        if (!effectiveTermId) { setError('Please select the term this payment is for.'); return }
        const amountPaid = parseFloat(form.amount_paid)
        if (!(amountPaid > 0)) { setError('Enter an amount greater than zero.'); return }

        setError('')
        setSaving(true)

        try {
            // Check again right now: someone else may have just recorded a payment
            const alreadyPaid = await fetchPaid(selectedStudent, selectedFee, effectiveTermId)
            const owedNow = Math.max(0, feeAmount - alreadyPaid)
            if (amountPaid > owedNow) {
                setError(
                    owedNow === 0
                        ? 'This fee is already fully paid.'
                        : `That is more than the balance. Only ₦${owedNow.toLocaleString()} is still owed on this fee.`
                )
                return
            }

            const { data: receiptNumber } = await supabase
                .rpc('generate_receipt_number', { p_school_id: schoolId })

            const totalPaidSoFar = alreadyPaid + amountPaid
            const remainingBalance = Math.max(0, feeAmount - totalPaidSoFar)
            const paymentStatus = remainingBalance === 0 ? 'Full' : 'Part Payment'

            const { error: payError } = await supabase
                .from('payments')
                .insert([{
                    school_id: schoolId,
                    fee_id: selectedFee.id,
                    student_id: selectedStudent.id,
                    student_system_id: selectedStudent.admission_number,
                    amount_paid: amountPaid,
                    balance: remainingBalance,
                    payment_date: form.payment_date,
                    payment_method: form.payment_method,
                    payment_status: paymentStatus,
                    receipt_number: receiptNumber,
                    received_by: staffId,
                    session_id: selectedFee.session_id || null,
                    term_id: effectiveTermId,
                }])

            if (payError) throw payError

            setSuccess({
                receipt: receiptNumber,
                student: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
                amount: amountPaid,
                totalPaid: totalPaidSoFar,
                balance: remainingBalance,
                status: paymentStatus,
                date: new Date(form.payment_date).toLocaleDateString('en-GB'),
            })

            // Reset form
            setSelectedStudent(null)
            setForm({
                fee_id: '',
                amount_paid: '',
                payment_date: todayIso(),
                payment_method: '',
                term_id: '',
            })
            setPreviouslyPaid(0)

        } catch (err) {
            setError(`Failed to record payment: ${err.message || 'please try again.'}`)
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
                <select name="fee_id" value={form.fee_id} onChange={handleChange} required disabled={!selectedStudent} className={inputClass}>
                  <option value="">{selectedStudent ? 'Select Fee' : 'Select a student first'}</option>
                  {applicableFees.map(f => (
                    <option key={f.id} value={f.id}>{feeLabel(f)}</option>
                  ))}
                </select>
                {selectedStudent && applicableFees.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No active fee applies to this student's section or class.
                  </p>
                )}
              </div>

              {selectedFee && (
                <div className="sm:col-span-2 space-y-2">
                  <div className="bg-blue-50 border border-primary/10 rounded-lg px-4 py-3 text-sm text-primary">
                    Fee Amount: <span className="font-bold">₦{Number(feeAmount).toLocaleString()}</span>
                    {!selectedFee.term_id && <span className="text-xs text-gray-500"> (charged each term — this is the amount for the term chosen below)</span>}
                  </div>
                  {previouslyPaid > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                      Previously Paid: <span className="font-bold">₦{Number(previouslyPaid).toLocaleString()}</span>
                      {' '}— Remaining: <span className="font-bold">₦{Number(remainingBefore).toLocaleString()}</span>
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

              {form.amount_paid && selectedFee && (
                <div className="flex items-end pb-1">
                  <div className={`w-full rounded-lg px-4 py-3 text-sm font-medium ${
                    overpaying
                      ? 'bg-red-50 text-red-600'
                      : balance === 0
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}>
                    {overpaying
                      ? `More than the balance — only ₦${Number(remainingBefore).toLocaleString()} is owed`
                      : balance === 0
                        ? '✅ Full Payment'
                        : `Balance: ₦${Number(balance).toLocaleString()}`
                    }
                  </div>
                </div>
              )}

              <div>
                <label className={labelClass}>Payment Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="payment_date"
                  value={form.payment_date}
                  max={todayIso()}
                  onChange={handleChange}
                  required
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
                <p className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  {feeSession?.name || 'Taken from the fee you pick'}
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Term {selectedFee && !selectedFee.term_id && <span className="text-red-500">*</span>}
                </label>
                {selectedFee?.term_id ? (
                  <p className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                    {feeTerms.find(t => t.id === selectedFee.term_id)?.name || 'Term of this fee'}
                  </p>
                ) : (
                  <select
                    name="term_id"
                    value={form.term_id}
                    onChange={handleChange}
                    required={!!selectedFee}
                    disabled={!selectedFee}
                    className={inputClass}
                  >
                    <option value="">{selectedFee ? 'Select Term' : 'Pick a fee first'}</option>
                    {feeTerms.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

            </div>
          </div>

          <div className="flex gap-3 pb-8">
            <button
              type="submit"
              disabled={saving || overpaying}
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