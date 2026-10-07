export const ROLES = {
  ADMIN: 'Admin',
  HEADMASTER: 'Headmaster',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
}

export const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
  { min: 60, max: 69,  grade: 'B', remark: 'Very Good' },
  { min: 50, max: 59,  grade: 'C', remark: 'Good' },
  { min: 40, max: 49,  grade: 'D', remark: 'Fair' },
  { min: 0,  max: 39,  grade: 'F', remark: 'Poor' },
]

export const getGrade = (total) => {
  const found = GRADE_SCALE.find(g => total >= g.min && total <= g.max)
  return found || { grade: 'F', remark: 'Poor' }
}

export const SECTIONS = ['Nursery', 'Primary']
export const TERMS = ['First Term', 'Second Term', 'Third Term']
export const GENDERS = ['Male', 'Female']
export const GUARDIAN_RELATIONSHIPS = ['Father', 'Mother', 'Uncle', 'Aunt', 'Other']
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'POS']
export const EMPLOYMENT_STATUSES = ['Active', 'Suspended', 'Resigned', 'Terminated']
export const STUDENT_STATUSES = ['Active', 'Promoted', 'Demoted', 'Withdrawn', 'Graduated']