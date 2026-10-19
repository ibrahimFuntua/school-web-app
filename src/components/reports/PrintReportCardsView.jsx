import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import { useSections } from '../../hooks/useSections'
import ReportCardView from '../shared/ReportCardView'

// Pick a class, tick the students, print all their report cards in one go.
// mode "admin": Admin, Head Teacher or Principal (their own sections).
// mode "teacher": a Form Master or class teacher, for their own classes.
const PrintReportCardsView = ({ mode }) => {
  const { schoolId, user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const { sectionNames, restricted, loading: sectionsLoading } = useSections()

  const [options, setOptions] = useState([])
  const [loadedOptions, setLoadedOptions] = useState(false)
  const [selected, setSelected] = useState('')
  const [students, setStudents] = useState([])
  const [cards, setCards] = useState({})
  const [ticked, setTicked] = useState([])
  const [loading, setLoading] = useState(false)
  const [printIds, setPrintIds] = useState(null)

  // The classes this person can print
  useEffect(() => {
    const loadOptions = async () => {
      if (!schoolId || sectionsLoading) return

      if (mode === 'teacher') {
        const { data: me } = await supabase
          .from('staff').select('id').eq('auth_user_id', user.id).maybeSingle()
        if (!me) { setOptions([]); setLoadedOptions(true); return }
        const { data } = await supabase
          .from('teacher_classes')
          .select('class_id, arm_id, classes(id, name, section), arms(id, name)')
          .eq('staff_id', me.id)
        setOptions((data || []).filter(r => r.classes).map(r => ({
          key: `${r.class_id}_${r.arm_id || ''}`,
          classId: r.class_id,
          armId: r.arm_id || null,
          label: `${r.classes.name}${r.arms ? ' ' + r.arms.name : ''}`,
        })))
      } else {
        let query = supabase
          .from('classes')
          .select('id, name, section, has_arms, arms(id, name, is_active)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('section').order('name')
        if (restricted) query = query.in('section', sectionNames.length > 0 ? sectionNames : ['__none__'])
        const { data } = await query
        const list = []
        ;(data || []).forEach(c => {
          if (c.has_arms) {
            ;(c.arms || []).filter(a => a.is_active).forEach(a => list.push({
              key: `${c.id}_${a.id}`, classId: c.id, armId: a.id, label: `${c.name} ${a.name}`,
            }))
          } else {
            list.push({ key: `${c.id}_`, classId: c.id, armId: null, label: c.name })
          }
        })
        setOptions(list)
      }
      setLoadedOptions(true)
    }
    loadOptions()
  }, [schoolId, sectionsLoading, mode])

  const option = options.find(o => o.key === selected)

  // The class list, with the state of each report card
  useEffect(() => {
    if (!option || !currentTerm) { setStudents([]); setCards({}); setTicked([]); return }
    const load = async () => {
      setLoading(true)
      let studentQuery = supabase
        .from('students')
        .select('id, first_name, middle_name, last_name, admission_number')
        .eq('class_id', option.classId)
        .eq('status', 'Active')
        .order('last_name')
        .order('first_name')
      if (option.armId) studentQuery = studentQuery.eq('arm_id', option.armId)
      const { data: studentData } = await studentQuery
      const list = studentData || []

      const { data: cardData } = await supabase
        .from('report_cards')
        .select('student_id, is_published, teacher_remark')
        .eq('term_id', currentTerm.id)
        .in('student_id', list.map(s => s.id))
      const cardMap = {}
      cardData?.forEach(c => { cardMap[c.student_id] = c })

      setStudents(list)
      setCards(cardMap)
      setTicked(list.map(s => s.id))
      setLoading(false)
    }
    load()
  }, [selected, currentTerm?.id])

  const toggle = (id) =>
    setTicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const publishedIds = students.filter(s => cards[s.id]?.is_published).map(s => s.id)
  const selectClass = "px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"

  const statusOf = (id) => {
    const c = cards[id]
    if (!c) return { label: 'No card yet', style: 'bg-gray-100 text-gray-500' }
    return c.is_published
      ? { label: 'Published', style: 'bg-green-50 text-green-700' }
      : { label: 'Draft', style: 'bg-amber-50 text-amber-600' }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Print Report Cards</h1>
        <p className="text-gray-500 text-sm mt-1">
          Print the report cards of a whole class at once, one per page. Choose "Save as PDF" to keep them as one file.
        </p>
      </div>

      {!currentTerm && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
          No current term is set.
        </div>
      )}

      {loadedOptions && options.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-gray-400">
          {mode === 'teacher'
            ? 'You are not a Form Master or class teacher of any class yet.'
            : 'There are no classes to show.'}
        </div>
      )}

      {options.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={selectClass}>
            <option value="">Select class</option>
            {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {currentTerm && <span className="text-sm text-gray-500">{currentTerm.name}</span>}
        </div>
      )}

      {option && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-500">{ticked.length} of {students.length} ticked</span>
              <button onClick={() => setTicked(students.map(s => s.id))} className="text-primary underline text-xs">All</button>
              <button onClick={() => setTicked([])} className="text-primary underline text-xs">None</button>
              <button onClick={() => setTicked(publishedIds)} className="text-primary underline text-xs">Published only</button>
            </div>
            <button
              onClick={() => setPrintIds(students.filter(s => ticked.includes(s.id)).map(s => s.id))}
              disabled={ticked.length === 0}
              className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60"
            >
              <Printer size={15} />
              Print {ticked.length} report card{ticked.length === 1 ? '' : 's'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 w-10"></th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Admission No.</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Report card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400 animate-pulse">Loading...</td></tr>
                )}
                {!loading && students.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-10 text-gray-400">No students in this class.</td></tr>
                )}
                {!loading && students.map(s => {
                  const status = statusOf(s.id)
                  return (
                    <tr key={s.id}>
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={ticked.includes(s.id)}
                          onChange={() => toggle(s.id)}
                          className="w-4 h-4 accent-primary"
                        />
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">
                        {s.last_name} {s.first_name} {s.middle_name || ''}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{s.admission_number}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.style}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-xs text-gray-400 border-t border-gray-100">
            Draft cards print too, so you can check them before publishing.
          </p>
        </div>
      )}

      {printIds && currentTerm && (
        <ReportCardView
          studentIds={printIds}
          batchTitle={`${option?.label} · ${currentTerm.name}`}
          termId={currentTerm.id}
          sessionId={currentSession?.id}
          onClose={() => setPrintIds(null)}
        />
      )}
    </div>
  )
}

export default PrintReportCardsView