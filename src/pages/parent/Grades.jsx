import { useEffect, useState } from 'react'
import ParentLayout from '../../components/layout/ParentLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useTermStore } from '../../store/termStore'

const ParentGrades = () => {
  const { user } = useAuthStore()
  const { currentSession, currentTerm } = useTermStore()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [grades, setGrades] = useState([])
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
    if (selectedChild && currentTerm) fetchGrades()
  }, [selectedChild, currentTerm])

  const fetchGrades = async () => {
    const { data } = await supabase
      .from('grades')
      .select('*, subjects(name)')
      .eq('student_id', selectedChild.id)
      .eq('term_id', currentTerm.id)
      .order('subjects(name)')

    setGrades(data || [])
  }

  const totalScore = grades.reduce((s, g) => s + Number(g.total || 0), 0)
  const average = grades.length > 0 ? (totalScore / grades.length).toFixed(1) : 0

  if (loading) return (
    <ParentLayout>
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </ParentLayout>
  )

  return (
    <ParentLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Grades</h1>
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

      {/* Average Card */}
      {grades.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Overall Average</p>
              <p className={`text-3xl font-bold mt-1 ${
                Number(average) >= 75 ? 'text-green-600' :
                Number(average) >= 50 ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {average}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Total Score</p>
              <p className="text-2xl font-bold text-primary mt-1">{totalScore}</p>
              <p className="text-xs text-gray-400">{grades.length} subjects</p>
            </div>
          </div>
        </div>
      )}

      {/* Grades Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-white">
                <th className="text-left px-6 py-3 text-xs font-semibold">Subject</th>
                <th className="text-center px-4 py-3 text-xs font-semibold">CA1</th>
                <th className="text-center px-4 py-3 text-xs font-semibold">CA2</th>
                <th className="text-center px-4 py-3 text-xs font-semibold">Exam</th>
                <th className="text-center px-4 py-3 text-xs font-semibold">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grades.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No grades available for this term.
                  </td>
                </tr>
              )}
              {grades.map((grade, index) => (
                <tr key={grade.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-3 font-medium text-gray-800">
                    {grade.subjects?.name}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{grade.ca1 ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{grade.ca2 ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{grade.exam_score ?? '—'}</td>
                  <td className="px-4 py-3 text-center font-bold text-primary">{grade.total ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-sm ${
                      grade.grade === 'A' ? 'text-green-600' :
                      grade.grade === 'B' ? 'text-blue-600' :
                      grade.grade === 'C' ? 'text-amber-600' :
                      grade.grade === 'D' ? 'text-orange-500' :
                      'text-red-500'
                    }`}>
                      {grade.grade ?? '—'}
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

export default ParentGrades