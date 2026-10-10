import { useEffect, useState } from 'react'
import ParentLayout from '../../components/layout/ParentLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { loadChildOutstanding } from '../../lib/feeUtils'

const ParentFees = () => {
  const { user } = useAuthStore()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [payments, setPayments] = useState([])
  const [bills, setBills] = useState({ items: [], owed: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChildren = async () => {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!parent) return

      const { data } = await supabase
        .from('parent_students')
        .select('*, students(*, classes(name))')
        .eq('parent_id', parent.id)

      const list = data?.map(ps => ps.students) || []
      setChildren(list)
      if (list.length > 0) setSelectedChild(list[0])
      setLoading(false)
    }
    if (user) fetchChildren()
  }, [user])

  useEffect(() => {
    if (selectedChild) fetchPayments()
  }, [selectedChild])

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, fees(name), sessions(name), terms(name)')
      .eq('student_id', selectedChild.id)
      .eq('is_void', false)
      .order('payment_date', { ascending: false })

    setPayments(data || [])
    try {
      setBills(await loadChildOutstanding(selectedChild))
    } catch (err) {
      setBills({ items: [], owed: 0 })
    }
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
  const totalBalance = bills.owed

  if (loading) return (
    <ParentLayout>
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </ParentLayout>
  )

  return (
    <ParentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Fee History</h1>
        <p className="text-gray-500 text-sm mt-1">
          All payment records for your child.
        </p>
      </div>

      {/* Child Tabs */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                selectedChild?.id === child.id
                  ? 'bg-primary text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {child.first_name} {child.last_name}
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">
            ₦{totalPaid.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${totalBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            ₦{totalBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fee</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No payment records found.
                  </td>
                </tr>
              )}
              {payments.map(payment => (
                <tr key={payment.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3 text-xs font-mono text-gray-500">
                    {payment.receipt_number}
                  </td>
                  <td className="px-6 py-3 text-gray-700">{payment.fees?.name}</td>
                  <td className="px-6 py-3 font-semibold text-green-700">
                    ₦{Number(payment.amount_paid).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-amber-600">
                    ₦{Number(payment.balance).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(payment.payment_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-3">
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
    </ParentLayout>
  )
}

export default ParentFees