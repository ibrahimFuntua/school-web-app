import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, UserCheck, CalendarCheck, Wallet, FileText, AlertCircle,
  ClipboardList, Printer, Megaphone, GraduationCap,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useSections } from '../../hooks/useSections'
import { fetchAllRows, loadOutstanding } from '../../lib/feeUtils'

const money = (n) => `₦${Number(n || 0).toLocaleString()}`

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The Head Teacher's / Principal's home page: their own sections at a glance
const HeadmasterDashboard = () => {
  const { schoolId } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const { sections, sectionNames, position, loading: sectionsLoading } = useSections()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feesNote, setFeesNote] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!schoolId || sectionsLoading) return
      if (sectionNames.length === 0) { setData(null); setLoading(false); return }

      setLoading(true)
      setFeesNote('')
      try {
        const today = todayIso()
        const weekend = [0, 6].includes(new Date().getDay())
        const managedIds = sections.map(s => s.id)

        const [classRes, students, staffRes, holidayRes] = await Promise.all([
          supabase.from('classes').select('id, name, section')
            .eq('school_id', schoolId).eq('is_active', true).in('section', sectionNames),
          fetchAllRows(() =>
            supabase.from('students').select('id, gender, section, class_id')
              .eq('school_id', schoolId).eq('status', 'Active')
              .in('section', sectionNames).order('id')),
          supabase.from('staff').select('id, role, staff_sections(section_id)').eq('school_id', schoolId),
          supabase.from('school_holidays').select('reason')
            .eq('school_id', schoolId).eq('date', today).maybeSingle(),
        ])

        const classes = classRes.data || []
        const classIds = classes.map(c => c.id)
        const schoolDay = !weekend && !holidayRes.data

        // Staff who work in these sections (the Head Teacher and Principal themselves are not counted)
        const staffCount = (staffRes.data || []).filter(s =>
          !['Head Teacher', 'Principal'].includes(s.role) &&
          (s.staff_sections || []).some(x => managedIds.includes(x.section_id))
        ).length

        // Today's register
        let attendanceRows = []
        if (schoolDay && classIds.length > 0) {
          attendanceRows = await fetchAllRows(() =>
            supabase.from('attendance').select('class_id, status')
              .eq('date', today).in('class_id', classIds).order('id'))
        }
        const markedClassIds = new Set(attendanceRows.map(a => a.class_id))
        const studentsPerClass = {}
        students.forEach(s => { studentsPerClass[s.class_id] = (studentsPerClass[s.class_id] || 0) + 1 })
        const unmarkedClasses = schoolDay
          ? classes.filter(c => studentsPerClass[c.id] > 0 && !markedClassIds.has(c.id))
          : []

        // Report cards this term
        let cardRows = []
        if (currentTerm && classIds.length > 0) {
          cardRows = await fetchAllRows(() =>
            supabase.from('report_cards').select('class_id, is_published')
              .in('class_id', classIds).eq('term_id', currentTerm.id).order('id'))
        }

        // Fees this term
        let billRows = []
        let paymentRows = []
        if (currentSession && currentTerm) {
          try {
            const [bills, payments] = await Promise.all([
              loadOutstanding({ schoolId, sessionId: currentSession.id, termId: currentTerm.id }),
              fetchAllRows(() =>
                supabase.from('payments').select('amount_paid, students(section)')
                  .eq('school_id', schoolId).eq('is_void', false)
                  .eq('session_id', currentSession.id).eq('term_id', currentTerm.id).order('id')),
            ])
            billRows = bills.rows.filter(r => sectionNames.includes(r.student.section))
            paymentRows = payments.filter(p => sectionNames.includes(p.students?.section))
          } catch (err) {
            setFeesNote('The fee figures could not be loaded.')
          }
        }

        // One row per section
        const bySection = sections.map(sec => {
          const secClassIds = classes.filter(c => c.section === sec.name).map(c => c.id)
          const att = attendanceRows.filter(a => secClassIds.includes(a.class_id))
          const secCards = cardRows.filter(c => secClassIds.includes(c.class_id))
          const secBills = billRows.filter(r => r.student.section === sec.name)
          return {
            id: sec.id,
            name: sec.name,
            students: students.filter(s => s.section === sec.name).length,
            marked: att.length,
            attended: att.filter(a => a.status === 'Present' || a.status === 'Late').length,
            absent: att.filter(a => a.status === 'Absent').length,
            billed: secBills.reduce((s, r) => s + r.charged, 0),
            owed: secBills.reduce((s, r) => s + r.owed, 0),
            collected: paymentRows
              .filter(p => p.students?.section === sec.name)
              .reduce((s, p) => s + Number(p.amount_paid || 0), 0),
            cardsPublished: secCards.filter(c => c.is_published).length,
            cardsTotal: secCards.length,
          }
        })

        const sum = (key) => bySection.reduce((s, r) => s + r[key], 0)
        setData({
          bySection,
          unmarkedClasses,
          schoolDay,
          holidayReason: holidayRes.data?.reason || (weekend ? 'Weekend' : ''),
          totalStudents: students.length,
          boys: students.filter(s => (s.gender || '').toLowerCase().startsWith('m')).length,
          girls: students.filter(s => (s.gender || '').toLowerCase().startsWith('f')).length,
          staffCount,
          marked: sum('marked'),
          attended: sum('attended'),
          absent: sum('absent'),
          collected: sum('collected'),
          owed: sum('owed'),
          cardsPublished: sum('cardsPublished'),
          cardsTotal: sum('cardsTotal'),
        })
      } catch (err) {
        console.error('Dashboard error:', err)
      }
      setLoading(false)
    }
    load()
  }, [schoolId, sectionsLoading, currentTerm?.id, currentSession?.id, sectionNames.join('|')])

  const links = [
    { label: 'Report Cards', desc: 'Review, publish, print', icon: FileText, path: '/headmaster/report-cards' },
    { label: 'Marks Tracker', desc: 'Who has entered marks', icon: ClipboardList, path: '/admin/marks-tracker' },
    { label: 'Print Report Cards', desc: 'Whole class at once', icon: Printer, path: '/admin/print-report-cards' },
    { label: 'Students', desc: 'Records and enrolment', icon: GraduationCap, path: '/admin/students' },
    { label: 'Staff', desc: 'Teachers and assignments', icon: UserCheck, path: '/admin/staff' },
    { label: 'Fee Reports', desc: 'Payments and receipts', icon: Wallet, path: '/admin/fees/reports' },
    { label: 'Announcements', desc: 'Notices for your sections', icon: Megaphone, path: '/admin/announcements' },
  ]

  const rate = data && data.marked > 0 ? Math.round((data.attended / data.marked) * 100) : null

  const cards = data ? [
    {
      label: 'Students', value: data.totalStudents, icon: Users, color: 'text-primary bg-blue-50',
      sub: `${data.boys} boys · ${data.girls} girls`,
    },
    {
      label: 'Staff', value: data.staffCount, icon: UserCheck, color: 'text-purple-600 bg-purple-50',
      sub: 'in your sections',
    },
    {
      label: 'Attendance today',
      value: !data.schoolDay ? '—' : rate === null ? 'Not marked' : `${rate}%`,
      icon: CalendarCheck, color: 'text-green-600 bg-green-50',
      sub: !data.schoolDay
        ? `No school today${data.holidayReason ? ` (${data.holidayReason})` : ''}`
        : `${data.attended} present · ${data.absent} absent`,
    },
    {
      label: 'Fees collected', value: money(data.collected), icon: Wallet, color: 'text-green-600 bg-green-50',
      sub: currentTerm ? currentTerm.name : '',
    },
    {
      label: 'Still owed', value: money(data.owed), icon: Wallet, color: 'text-amber-600 bg-amber-50',
      sub: 'compulsory fees',
    },
    {
      label: 'Report cards', value: `${data.cardsPublished}/${data.cardsTotal}`, icon: FileText,
      color: 'text-primary bg-blue-50', sub: 'published',
    },
  ] : []

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {position || 'Your'} sections: {sectionNames.length > 0 ? sectionNames.join(', ') : 'none yet'}
          {currentSession && currentTerm ? ` · ${currentSession.name}, ${currentTerm.name}` : ''}
        </p>
      </div>

      {(loading || sectionsLoading) && (
        <p className="text-gray-400 animate-pulse">Loading your dashboard...</p>
      )}

      {!loading && !sectionsLoading && sectionNames.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          No sections are assigned to you yet.
        </div>
      )}

      {!loading && data && (
        <>
          {/* Alerts */}
          <div className="space-y-2 mb-6">
            {data.unmarkedClasses.length > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  <span className="font-semibold">{data.unmarkedClasses.length}</span> class
                  {data.unmarkedClasses.length > 1 ? 'es have' : ' has'} not marked today's register:{' '}
                  {data.unmarkedClasses.map(c => c.name).join(', ')}
                </p>
              </div>
            )}
            {!currentTerm && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">No current term is set, so fees and report cards are not shown.</p>
              </div>
            )}
            {feesNote && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-600">{feesNote}</p>
              </div>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {cards.map(card => (
              <div key={card.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400">{card.label}</p>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                    <card.icon size={16} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* By section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">By section</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Section', 'Students', 'Present today', 'Fees collected', 'Still owed', 'Report cards'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.bySection.map(r => (
                    <tr key={r.id}>
                      <td className="px-6 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{r.students}</td>
                      <td className="px-6 py-3 text-right text-gray-700">
                        {!data.schoolDay ? '—' : r.marked === 0 ? 'Not marked' : `${r.attended}/${r.marked}`}
                      </td>
                      <td className="px-6 py-3 text-right text-green-600 font-medium">{money(r.collected)}</td>
                      <td className="px-6 py-3 text-right text-amber-600 font-medium">{money(r.owed)}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{r.cardsPublished}/{r.cardsTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {links.map(l => (
              <Link
                key={l.path}
                to={l.path}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-primary transition"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center">
                  <l.icon size={18} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{l.label}</p>
                  <p className="text-xs text-gray-400">{l.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  )
}

export default HeadmasterDashboard