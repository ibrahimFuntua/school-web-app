import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

// Tells a screen: is this school using departments at all, which section
// do they apply to, which mode (by_arm / by_student), and the list itself.
export const useDepartmentConfig = () => {
  const { schoolId } = useAuthStore()
  const [departmentSectionId, setDepartmentSectionId] = useState(null)
  const [departmentSectionName, setDepartmentSectionName] = useState('')
  const [departmentMode, setDepartmentMode] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cacheKey = `department_config_${schoolId}`
    const fetchConfig = async () => {
      if (!schoolId) return

      // Offline: use the last saved copy
      if (!navigator.onLine) {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey))
          if (cached) {
            setDepartmentSectionId(cached.departmentSectionId)
            setDepartmentSectionName(cached.departmentSectionName)
            setDepartmentMode(cached.departmentMode)
            setDepartments(cached.departments)
          }
        } catch (e) { /* nothing cached yet */ }
        setLoading(false)
        return
      }
      const { data: schoolData } = await supabase
        .from('schools')
        .select('department_section_id, department_mode')
        .eq('id', schoolId)
        .single()

      if (schoolData?.department_section_id) {
        setDepartmentSectionId(schoolData.department_section_id)
        setDepartmentMode(schoolData.department_mode)

        const { data: sectionData } = await supabase
          .from('school_sections')
          .select('name')
          .eq('id', schoolData.department_section_id)
          .single()
        setDepartmentSectionName(sectionData?.name || '')

        const { data: deptData } = await supabase
          .from('departments')
          .select('*')
          .eq('school_id', schoolId)
          .eq('section_id', schoolData.department_section_id)
          .order('name')
        setDepartments(deptData || [])
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            departmentSectionId: schoolData.department_section_id,
            departmentSectionName: sectionData?.name || '',
            departmentMode: schoolData.department_mode,
            departments: deptData || [],
          }))
        } catch (e) { /* storage full */ }
      } else {
        try { localStorage.removeItem(cacheKey) } catch (e) { /* ignore */ }
      }
      setLoading(false)
    }
    fetchConfig()
  }, [schoolId])

  return { departmentSectionId, departmentSectionName, departmentMode, departments, loading }
}