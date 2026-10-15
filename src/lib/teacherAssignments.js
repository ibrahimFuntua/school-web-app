import { supabase } from './supabase'

// Does this class's section assign teachers per class (Nursery / Primary style)
// or per subject (Secondary style)? Anything not set counts as "by class".
export const classModeOf = (cls, allSections) =>
  allSections.find(s => s.name === cls?.section)?.assignment_mode || 'by_class'

// What a teacher is responsible for:
// - classRows: the classes they register / handle as a whole (class teacher or Form Master)
// - gradeClasses: the classes they can enter marks for, ready for the grade screen.
//     A class they handle as a whole (class teacher, or Form Master) gives EVERY subject of that class.
//     A subject teacher gets one entry per class carrying ONLY the subjects they teach there.
export const loadTeacherClasses = async (staffId) => {
  const [classRes, taughtRes] = await Promise.all([
    supabase
      .from('teacher_classes')
      .select('*, classes(id, name, section), arms(id, name, department_id)')
      .eq('staff_id', staffId),
    supabase
      .from('teaching_assignments')
      .select('class_id, arm_id, subject_id, classes(id, name, section), arms(id, name, department_id)')
      .eq('staff_id', staffId),
  ])

  const classRows = classRes.data || []

  // A class row means the whole class: the class teacher in Nursery / Primary, or the Form Master
  // in a "by subject" section. Either way they can enter marks for every subject of that class.
  const wholeClass = classRows.filter(c => c.classes)
  const covered = new Set(wholeClass.map(c => `${c.class_id}|${c.arm_id || ''}`))

  const byClass = {}
  ;(taughtRes.data || []).forEach(a => {
    const groupKey = `${a.class_id}|${a.arm_id || ''}`
    // Skip it when the whole class, or this very arm, is already handled as a whole class
    if (!a.classes || covered.has(`${a.class_id}|`) || covered.has(groupKey)) return
    if (!byClass[groupKey]) {
      byClass[groupKey] = {
        id: `taught-${a.class_id}-${a.arm_id || 'all'}`,
        staff_id: staffId,
        class_id: a.class_id,
        arm_id: a.arm_id || null,
        classes: a.classes,
        arms: a.arms || null,
        viaSubject: true,
        subjectIds: [],
      }
    }
    byClass[groupKey].subjectIds.push(a.subject_id)
  })

  return { classRows, gradeClasses: [...wholeClass, ...Object.values(byClass)] }
}