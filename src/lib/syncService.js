import { supabase } from './supabase'
import {
  getPendingAttendance,
  clearPendingAttendance,
  getPendingGrades,
  clearPendingGrades,
} from './offlineDB'

export const syncPendingData = async () => {
  const results = { attendance: 0, grades: 0, errors: [] }

  // ---- SYNC ATTENDANCE ----
  try {
    const pendingAttendance = await getPendingAttendance()

    if (pendingAttendance.length > 0) {
      const localIds = pendingAttendance.map(r => r.localId)

      // Remove localId before sending to Supabase
      const records = pendingAttendance.map(({ localId, savedAt, ...rest }) => rest)

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,date' })

      if (error) {
        results.errors.push(`Attendance sync failed: ${error.message}`)
      } else {
        await clearPendingAttendance(localIds)
        results.attendance = records.length
      }
    }
  } catch (err) {
    results.errors.push(`Attendance: ${err.message}`)
  }

  // ---- SYNC GRADES ----
  try {
    const pendingGrades = await getPendingGrades()

    if (pendingGrades.length > 0) {
      const localIds = pendingGrades.map(r => r.localId)
      const records = pendingGrades.map(({ localId, savedAt, ...rest }) => rest)

      const { error } = await supabase
        .from('grades')
        .upsert(records, { onConflict: 'student_id,subject_id,term_id' })

      if (error) {
        results.errors.push(`Grades sync failed: ${error.message}`)
      } else {
        await clearPendingGrades(localIds)
        results.grades = records.length
      }
    }
  } catch (err) {
    results.errors.push(`Grades: ${err.message}`)
  }

  return results
}