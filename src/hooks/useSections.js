import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

// Replaces the old hardcoded SECTIONS list — each school defines its own
// (Nursery/Primary, or Lower/Upper Basic, or whatever fits them).
export const useSections = () => {
  const { schoolId } = useAuthStore()
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSections = async () => {
      if (!schoolId) return
      const { data } = await supabase
        .from('school_sections')
        .select('*')
        .eq('school_id', schoolId)
        .order('order_number')
      setSections(data || [])
      setLoading(false)
    }
    fetchSections()
  }, [schoolId])

  return { sections, sectionNames: sections.map(s => s.name), loading }
}