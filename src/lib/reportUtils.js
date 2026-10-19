import { supabase } from './supabase'
import { attachDepartmentLinks, subjectFitsDepartment } from './departmentUtils'

// Keeps, for each student, only the grades of subjects that belong to their department
export const gradesInDepartment = async ({ students, grades, classId, usesDepartments, departmentMode }) => {
  if (!usesDepartments || !grades || grades.length === 0) return grades || []

  const { data: armRows } = await supabase
    .from('arms').select('id, department_id').eq('class_id', classId)
  const armDepartment = {}
  armRows?.forEach(a => { armDepartment[a.id] = a.department_id })

  const departmentOf = {}
  students.forEach(s => {
    departmentOf[s.id] = departmentMode === 'by_arm' ? armDepartment[s.arm_id] : s.department_id
  })

  const subjects = await attachDepartmentLinks(
    [...new Set(grades.map(g => g.subject_id))].map(id => ({ id }))
  )
  const subjectById = {}
  subjects.forEach(s => { subjectById[s.id] = s })

  return grades.filter(g => subjectFitsDepartment(subjectById[g.subject_id], departmentOf[g.student_id]))
}

// Each student's average mark, and how many subjects have a mark above zero
export const summariseGrades = (students, grades) => {
  const averages = {}
  const markCounts = {}
  students.forEach(s => {
    const mine = grades.filter(g => g.student_id === s.id)
    const total = mine.reduce((sum, g) => sum + Number(g.total || 0), 0)
    averages[s.id] = mine.length > 0 ? Number((total / mine.length).toFixed(1)) : 0
    markCounts[s.id] = mine.filter(g => Number(g.total || 0) > 0).length
  })
  return { averages, markCounts }
}