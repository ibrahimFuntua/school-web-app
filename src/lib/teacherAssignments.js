import { supabase } from './supabase'

// Does this class's section assign teachers per class (Nursery / Primary style)
// or per subject (Secondary style)? Anything not set counts as "by class".
export const classModeOf = (cls, allSections) =>
  allSections.find(s => s.name === cls?.section)?.assignment_mode || 'by_class'

// What a teacher is responsible for:
// - classRows: the classes they register / handle as a whole (class teacher or Form Master)
// - gradeClasses: the classes they can enter marks for, ready for the grade screen.
//     Whole-class teachers get every subject of their class.
//     Subject teachers get one entry per class carrying ONLY the subjects they teach there.
export const loadTeacherClasses = async (staffId, schoolId) => {
  const [classRes, taughtRes, sectionRes] = await Promise.all([
    supabase
      .from('teacher_classes')
      .select('*, classes(id, name, section), arms(id, name, department_id)')
      .eq('staff_id', staffId),
    supabase
      .from('teaching_assignments')
      .select('class_id, subject_id, classes(id, name, section)')
      .eq('staff_id', staffId),
    supabase
      .from('school_sections')
      .select('name, assignment_mode')
      .eq('school_id', schoolId),
  ])

  const classRows = classRes.data || []
  const modeBySection = {}
  ;(sectionRes.data || []).forEach(s => { modeBySection[s.name] = s.assignment_mode || 'by_class' })

  // In a "by subject" section a class row only means Form Master: it gives the register, not marks
  const wholeClass = classRows.filter(c => c.classes && modeBySection[c.classes.section] !== 'by_subject')

  const byClass = {}
  ;(taughtRes.data || []).forEach(a => {
    if (!a.classes) return
    if (!byClass[a.class_id]) {
      byClass[a.class_id] = {
        id: `taught-${a.class_id}`,
        staff_id: staffId,
        class_id: a.class_id,
        arm_id: null,
        classes: a.classes,
        arms: null,
        viaSubject: true,
        subjectIds: [],
      }
    }
    byClass[a.class_id].subjectIds.push(a.subject_id)
  })

  return { classRows, gradeClasses: [...wholeClass, ...Object.values(byClass)] }
}