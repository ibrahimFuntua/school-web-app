import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Megaphone } from 'lucide-react'

// Which sections does this teacher / parent belong to?
const findMySectionNames = async (role, userId) => {
  const names = new Set()
  if (!userId) return []
  if (role === 'Parent') {
    const { data: parent } = await supabase
      .from('parents').select('id').eq('auth_user_id', userId).maybeSingle()
    if (parent) {
      const { data } = await supabase
        .from('parent_students').select('students(section)').eq('parent_id', parent.id)
      ;(data || []).forEach(r => { if (r.students?.section) names.add(r.students.section) })
    }
  } else {
    const { data: staff } = await supabase
      .from('staff').select('id').eq('auth_user_id', userId).maybeSingle()
    if (staff) {
      const { data } = await supabase
        .from('teacher_classes').select('classes(section)').eq('staff_id', staff.id)
      ;(data || []).forEach(r => { if (r.classes?.section) names.add(r.classes.section) })
      const { data: taught } = await supabase
        .from('teaching_assignments').select('classes(section)').eq('staff_id', staff.id)
      ;(taught || []).forEach(r => { if (r.classes?.section) names.add(r.classes.section) })
    }
  }
  return [...names]
}

const AnnouncementsFeed = () => {
  const { schoolId, role, user } = useAuthStore()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!schoolId) return
      const { data } = await supabase
        .from('announcements')
        .select('*, staff(first_name, last_name)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // Notices for the whole school, plus the ones for sections this person belongs to
      const mine = await findMySectionNames(role, user?.id)
      const { data: sectionRows } = await supabase
        .from('school_sections').select('id, name').eq('school_id', schoolId)
      const myIds = (sectionRows || []).filter(s => mine.includes(s.name)).map(s => s.id)

      setAnnouncements((data || []).filter(a => !a.section_id || myIds.includes(a.section_id)))
      setLoading(false)
    }
    fetchAnnouncements()
  }, [schoolId])

  if (loading) return <p className="text-gray-400 animate-pulse">Loading...</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Announcements</h1>
        <p className="text-gray-500 text-sm mt-1">
          Latest notices from the school.
        </p>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-16 text-center">
          <Megaphone size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">No announcements at this time.</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {announcements.map(announcement => (
            <div
              key={announcement.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">
                    {announcement.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <p className="text-xs text-gray-400">
                      {announcement.staff?.first_name} {announcement.staff?.last_name}
                    </p>
                    <span className="text-gray-200">·</span>
                    <p className="text-xs text-gray-400">
                      {new Date(announcement.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AnnouncementsFeed