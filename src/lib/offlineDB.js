import { openDB } from 'idb'

const DB_NAME = 'school-offline-db'
const DB_VERSION = 1

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending attendance records
      if (!db.objectStoreNames.contains('pending_attendance')) {
        const attendanceStore = db.createObjectStore('pending_attendance', {
          keyPath: 'localId',
          autoIncrement: true,
        })
        attendanceStore.createIndex('date', 'date')
        attendanceStore.createIndex('class_id', 'class_id')
      }

      // Pending grades
      if (!db.objectStoreNames.contains('pending_grades')) {
        db.createObjectStore('pending_grades', {
          keyPath: 'localId',
          autoIncrement: true,
        })
      }

      // Cached students per teacher
      if (!db.objectStoreNames.contains('cached_students')) {
        const studentStore = db.createObjectStore('cached_students', {
          keyPath: 'id',
        })
        studentStore.createIndex('class_id', 'class_id')
      }

      // Cached classes for teacher
      if (!db.objectStoreNames.contains('cached_classes')) {
        db.createObjectStore('cached_classes', { keyPath: 'id' })
      }

      // Cached subjects
      if (!db.objectStoreNames.contains('cached_subjects')) {
        db.createObjectStore('cached_subjects', { keyPath: 'id' })
      }

      // Sync log
      if (!db.objectStoreNames.contains('sync_log')) {
        db.createObjectStore('sync_log', {
          keyPath: 'id',
          autoIncrement: true,
        })
      }
    },
  })
}

// ---- ATTENDANCE ----
export const savePendingAttendance = async (records) => {
  const db = await initDB()
  const tx = db.transaction('pending_attendance', 'readwrite')
  for (const record of records) {
    await tx.store.add({ ...record, savedAt: new Date().toISOString() })
  }
  await tx.done
}

export const getPendingAttendance = async () => {
  const db = await initDB()
  return db.getAll('pending_attendance')
}

export const clearPendingAttendance = async (localIds) => {
  const db = await initDB()
  const tx = db.transaction('pending_attendance', 'readwrite')
  for (const id of localIds) {
    await tx.store.delete(id)
  }
  await tx.done
}

// ---- GRADES ----
export const savePendingGrades = async (records) => {
  const db = await initDB()
  const tx = db.transaction('pending_grades', 'readwrite')
  for (const record of records) {
    await tx.store.add({ ...record, savedAt: new Date().toISOString() })
  }
  await tx.done
}

export const getPendingGrades = async () => {
  const db = await initDB()
  return db.getAll('pending_grades')
}

export const clearPendingGrades = async (localIds) => {
  const db = await initDB()
  const tx = db.transaction('pending_grades', 'readwrite')
  for (const id of localIds) {
    await tx.store.delete(id)
  }
  await tx.done
}

// ---- CACHE STUDENTS ----
export const cacheStudents = async (students) => {
  const db = await initDB()
  const tx = db.transaction('cached_students', 'readwrite')
  await tx.store.clear()
  for (const student of students) {
    await tx.store.put(student)
  }
  await tx.done
}

export const getCachedStudents = async (classId) => {
  const db = await initDB()
  if (classId) {
    const index = db.transaction('cached_students').store.index('class_id')
    return index.getAll(classId)
  }
  return db.getAll('cached_students')
}

// ---- CACHE CLASSES ----
export const cacheClasses = async (classes) => {
  const db = await initDB()
  const tx = db.transaction('cached_classes', 'readwrite')
  await tx.store.clear()
  for (const cls of classes) {
    await tx.store.put(cls)
  }
  await tx.done
}

export const getCachedClasses = async () => {
  const db = await initDB()
  return db.getAll('cached_classes')
}

// ---- CACHE SUBJECTS ----
export const cacheSubjects = async (subjects) => {
  const db = await initDB()
  const tx = db.transaction('cached_subjects', 'readwrite')
  await tx.store.clear()
  for (const subject of subjects) {
    await tx.store.put(subject)
  }
  await tx.done
}

export const getCachedSubjects = async () => {
  const db = await initDB()
  return db.getAll('cached_subjects')
}

// ---- TEACHER META (staffId + assigned classes) ----
// Small, session-scoped data — localStorage is enough, and it lets us keep
// the exact teacher_classes join shape (class_id, arm_id, classes, arms)
// that MarkAttendance/EnterGrades expect, instead of the flattened rows
// cacheClasses() stores for other uses.
export const cacheTeacherMeta = (staffId, assignedClasses) => {
  localStorage.setItem('cached_staff_id', staffId)
  localStorage.setItem('cached_assigned_classes', JSON.stringify(assignedClasses || []))
}

export const getCachedTeacherMeta = () => {
  const staffId = localStorage.getItem('cached_staff_id')
  let assignedClasses = []
  try {
    assignedClasses = JSON.parse(localStorage.getItem('cached_assigned_classes') || '[]')
  } catch {
    assignedClasses = []
  }
  return { staffId, assignedClasses }
}

// ---- SCHOOL CONFIG (score config + grade scale) ----
// Needed offline too — without it, grade calculation has nothing to match
// against and would mark every student's total as 'F'.
export const cacheSchoolConfig = (scoreConfig, gradeScale) => {
  if (scoreConfig) localStorage.setItem('cached_score_config', JSON.stringify(scoreConfig))
  if (gradeScale) localStorage.setItem('cached_grade_scale', JSON.stringify(gradeScale))
}

export const getCachedSchoolConfig = () => {
  let scoreConfig = null
  let gradeScale = null
  try {
    scoreConfig = JSON.parse(localStorage.getItem('cached_score_config') || 'null')
    gradeScale = JSON.parse(localStorage.getItem('cached_grade_scale') || 'null')
  } catch {
    // ignore malformed cache
  }
  return { scoreConfig, gradeScale }
}

// ---- AUTH META (role + school info) ----
// So a cached login can still be routed to the right dashboard when the
// role/school lookup can't reach the server.
export const cacheAuthMeta = (role, schoolId, schoolName, schoolLogo) => {
  localStorage.setItem('cached_role', role || '')
  localStorage.setItem('cached_school_id', schoolId || '')
  localStorage.setItem('cached_school_name', schoolName || '')
  localStorage.setItem('cached_school_logo', schoolLogo || '')
}

export const getCachedAuthMeta = () => ({
  role: localStorage.getItem('cached_role') || null,
  schoolId: localStorage.getItem('cached_school_id') || null,
  schoolName: localStorage.getItem('cached_school_name') || null,
  schoolLogo: localStorage.getItem('cached_school_logo') || null,
})