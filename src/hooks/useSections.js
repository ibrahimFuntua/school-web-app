import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

// Replaces the old hardcoded SECTIONS list — each school defines its own
// (Nursery/Primary, or Lower/Upper Basic, or whatever fits them).
// A Head Teacher or Principal only manages some sections (each section says who manages it).
// Each person's position is remembered so it is only looked up once.
const positionCache = {}
const getPosition = async (userId) => {
  if (positionCache[userId] === undefined) {
    const { data } = await supabase
      .from('staff')
      .select('role')
      .eq('auth_user_id', userId)
      .maybeSingle()
    positionCache[userId] = data?.role || null
  }
  return positionCache[userId]
}

export const useSections = () => {
  const { schoolId, role, user } = useAuthStore()
  const [allSections, setAllSections] = useState([])
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!schoolId) return
      const { data } = await supabase
        .from('school_sections')
        .select('*')
        .eq('school_id', schoolId)
        .order('order_number')
      setAllSections(data || [])
      if (role === 'Headmaster' && user?.id) setPosition(await getPosition(user.id))
      setLoading(false)
    }
    load()
  }, [schoolId, role, user?.id])

  // Admin sees every section. A Head Teacher / Principal only sees the sections they manage.
  const restricted = role === 'Headmaster'
  const sections = restricted
    ? allSections.filter(s => s.managed_by && s.managed_by === position)
    : allSections

  return {
    sections,
    sectionNames: sections.map(s => s.name),
    sectionIds: sections.map(s => s.id),
    allSections,
    restricted,
    position,
    loading,
  }
}