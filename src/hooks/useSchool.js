import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export const useSchool = () => {
  const { schoolId } = useAuthStore()
  const [school, setSchool] = useState(null)

  useEffect(() => {
    const fetchSchool = async () => {
      if (!schoolId) return
      const { data } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single()
      setSchool(data)
    }
    fetchSchool()
  }, [schoolId])

  return school
}