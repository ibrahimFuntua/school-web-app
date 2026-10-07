import { supabase } from './supabase'

// Adds department_ids: [] to every subject, read from the subject_departments link table.
// A subject with no links is "core" - everyone in its section takes it.
export const attachDepartmentLinks = async (subjects) => {
  if (!subjects || subjects.length === 0) return subjects || []
  const { data: links } = await supabase
    .from('subject_departments')
    .select('subject_id, department_id')
    .in('subject_id', subjects.map(s => s.id))

  const map = {}
  ;(links || []).forEach(l => {
    if (!map[l.subject_id]) map[l.subject_id] = []
    map[l.subject_id].push(l.department_id)
  })
  return subjects.map(s => ({ ...s, department_ids: map[s.id] || [] }))
}

// The one rule everything uses: does this subject apply to this department?
// No links = core subject (applies to everyone). Links = only those departments.
export const subjectFitsDepartment = (subject, departmentId) => {
  const ids = subject?.department_ids || []
  if (ids.length === 0) return true
  return !!departmentId && ids.includes(departmentId)
}