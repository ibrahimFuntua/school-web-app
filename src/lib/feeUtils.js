import { supabase } from './supabase'

// Supabase returns at most 1000 rows per request, so big tables are read page by page.
export const fetchAllRows = async (makeQuery, pageSize = 1000) => {
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

const num = (v) => Number(v) || 0

// Does this fee apply to this student? Blank section / class on the fee means "everyone".
export const feeAppliesToStudent = (fee, student) => {
  if (!fee || !student) return false
  if (fee.section && fee.section !== student.section) return false
  if (fee.class_id && fee.class_id !== student.class_id) return false
  return true
}

// One "bill" = one student + one fee + one term.
// A fee with a term is billed once, in that term.
// A fee with no term ("every term") is billed again in every term.
const billKey = (p) => `${p.student_id}|${p.fee_id}|${p.fees?.term_id ? '' : (p.term_id || '')}`

// What is still owed, worked out from the fee price minus what was really paid
// (voided payments are ignored). Only looks at the bills that appear in `shown`.
export const outstandingForShown = (allPayments, shown = allPayments) => {
  const bills = {}
  allPayments.forEach(p => {
    if (p.is_void) return
    const k = billKey(p)
    if (!bills[k]) bills[k] = { price: num(p.fees?.amount), paid: 0 }
    bills[k].paid += num(p.amount_paid)
  })
  const wanted = new Set(shown.filter(p => !p.is_void).map(billKey))
  let total = 0
  wanted.forEach(k => {
    if (bills[k]) total += Math.max(0, bills[k].price - bills[k].paid)
  })
  return total
}

// Works out, for every student, every compulsory fee they should pay and what is still owed.
export const buildBills = ({ fees, students, payments, terms, termId }) => {
  const today = new Date().toISOString().split('T')[0]
  const started = (t) => !t.start_date || t.start_date <= today
  const scopeTerms = termId ? terms.filter(t => t.id === termId) : terms.filter(started)

  const paidInTerm = {}
  const paidOnFee = {}
  payments.forEach(p => {
    if (p.is_void) return
    const a = num(p.amount_paid)
    const t = `${p.student_id}|${p.fee_id}|${p.term_id || ''}`
    const f = `${p.student_id}|${p.fee_id}`
    paidInTerm[t] = (paidInTerm[t] || 0) + a
    paidOnFee[f] = (paidOnFee[f] || 0) + a
  })

  const makeItem = (fee, term, paid) => ({
    fee, term,
    charged: num(fee.amount),
    paid,
    owed: Math.max(0, num(fee.amount) - paid),
  })

  return students.map(student => {
    const items = []
    fees.forEach(fee => {
      if (fee.fee_type !== 'Compulsory') return
      if (!feeAppliesToStudent(fee, student)) return
      if (fee.term_id) {
        const term = scopeTerms.find(t => t.id === fee.term_id)
        if (term) items.push(makeItem(fee, term, paidOnFee[`${student.id}|${fee.id}`] || 0))
      } else {
        scopeTerms.forEach(term => {
          items.push(makeItem(fee, term, paidInTerm[`${student.id}|${fee.id}|${term.id}`] || 0))
        })
      }
    })
    return {
      student,
      items,
      charged: items.reduce((s, i) => s + i.charged, 0),
      paid: items.reduce((s, i) => s + Math.min(i.paid, i.charged), 0),
      owed: items.reduce((s, i) => s + i.owed, 0),
    }
  })
}

// Everyone in the school, for one session (and one term, or all terms so far when termId is '').
export const loadOutstanding = async ({ schoolId, sessionId, termId }) => {
  const [feesRes, termsRes] = await Promise.all([
    supabase.from('fees').select('*')
      .eq('school_id', schoolId).eq('is_active', true).eq('session_id', sessionId),
    supabase.from('terms').select('id, name, start_date')
      .eq('session_id', sessionId).order('start_date'),
  ])
  if (feesRes.error) throw feesRes.error
  const fees = feesRes.data || []
  const terms = termsRes.data || []
  if (fees.length === 0) return { rows: [], terms, fees }

  const students = await fetchAllRows(() =>
    supabase.from('students')
      .select('id, first_name, last_name, admission_number, section, class_id, classes(name), arms(name)')
      .eq('school_id', schoolId).eq('status', 'Active').order('id'))

  const payments = await fetchAllRows(() =>
    supabase.from('payments')
      .select('student_id, fee_id, term_id, amount_paid, is_void')
      .eq('school_id', schoolId).eq('is_void', false)
      .in('fee_id', fees.map(f => f.id)).order('id'))

  return { rows: buildBills({ fees, students, payments, terms, termId }), terms, fees }
}

// One child, across every session: everything that child still owes.
export const loadChildOutstanding = async (child) => {
  const [feesRes, termsRes, paymentsRes] = await Promise.all([
    supabase.from('fees').select('*').eq('school_id', child.school_id).eq('is_active', true),
    supabase.from('terms').select('id, name, start_date, session_id'),
    supabase.from('payments')
      .select('student_id, fee_id, term_id, amount_paid, is_void')
      .eq('student_id', child.id).eq('is_void', false),
  ])
  const fees = feesRes.data || []
  const terms = termsRes.data || []
  const payments = paymentsRes.data || []

  const sessionIds = [...new Set(fees.map(f => f.session_id).filter(Boolean))]
  const items = []
  sessionIds.forEach(sid => {
    const rows = buildBills({
      fees: fees.filter(f => f.session_id === sid),
      students: [child],
      payments,
      terms: terms.filter(t => t.session_id === sid),
      termId: '',
    })
    rows.forEach(r => items.push(...r.items))
  })
  return {
    items,
    owed: items.reduce((s, i) => s + i.owed, 0),
  }
}