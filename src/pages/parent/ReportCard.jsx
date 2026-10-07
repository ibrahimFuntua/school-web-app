import { useEffect, useState } from 'react'
import ParentLayout from '../../components/layout/ParentLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'
import ReportCardView from '../../components/shared/ReportCardView'
import { FileText } from 'lucide-react'

const ParentReportCard = () => {
  const { user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [reportCard, setReportCard] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [loading, setLoading] = useState(true)
  const [allReportCards, setAllReportCards] = useState([])


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
    if (selectedChild && currentTerm) checkReportCard()
  }, [selectedChild, currentTerm])

  const checkReportCard = async () => {
  // Fetch all published report cards for this student
    const { data } = await supabase
      .from('report_cards')
      .select('*, terms(name, session_id), sessions(name)')
      .eq('student_id', selectedChild.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    setReportCard(data?.[0] || null)
    setAllReportCards(data || [])
  }

  if (loading) return (
    <ParentLayout>
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </ParentLayout>
  )

  return (
    <ParentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Report Card</h1>
        <p className="text-gray-500 text-sm mt-1">
          {currentTerm?.name} — {currentSession?.name}
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

      {/* Report Card Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md mx-auto">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
          reportCard ? 'bg-green-50' : 'bg-gray-50'
        }`}>
          <FileText size={28} className={reportCard ? 'text-green-600' : 'text-gray-300'} />
        </div>

        {allReportCards.length > 0 ? (
        <div className="w-full space-y-3">
          <h2 className="font-bold text-gray-800 text-center mb-3">
            Published Report Cards
          </h2>
          {allReportCards.map((rc) => (
            <div
              key={rc.id}
              className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3"
            >
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {rc.terms?.name}
              </p>
              <p className="text-xs text-gray-500">
                {currentSession?.name || ''}
              </p>
            </div>
          <button
            onClick={() => {
              setReportCard(rc)
              setShowReport(true)
            }}
            className="bg-primary hover:bg-primary-light text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
          View
          </button>
        </div>
        ))}
        </div>
        ) : (
        <>
        <h2 className="font-bold text-gray-800 mb-1">
          Not Available Yet
        </h2>
        <p className="text-sm text-gray-500">
          No published report cards yet for {selectedChild?.first_name}.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Check back later or contact the school.
        </p>
        </>
      )}
      </div>

      {/* Report Card Modal */}
      {showReport && selectedChild && reportCard && (
      <ReportCardView
        studentId={selectedChild.id}
        termId={reportCard.term_id}
        sessionId={reportCard.session_id}
        onClose={() => setShowReport(false)}
      />
    )}
    </ParentLayout>
  )
}

export default ParentReportCard