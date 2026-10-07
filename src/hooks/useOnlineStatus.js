import { useState, useEffect } from 'react'
import { syncPendingData } from '../lib/syncService'
import {
  getPendingAttendance,
  getPendingGrades,
} from '../lib/offlineDB'

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  // Check pending count
  const checkPending = async () => {
    const attendance = await getPendingAttendance()
    const grades = await getPendingGrades()
    setPendingCount(attendance.length + grades.length)
  }

  useEffect(() => {
    checkPending()
  }, [])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)

      // Check if there's pending data to sync
      const attendance = await getPendingAttendance()
      const grades = await getPendingGrades()

      if (attendance.length > 0 || grades.length > 0) {
        setIsSyncing(true)
        try {
          const result = await syncPendingData()
          setSyncResult(result)
          setPendingCount(0)
          setTimeout(() => setSyncResult(null), 5000)
        } catch (err) {
          console.error('Sync failed:', err)
        } finally {
          setIsSyncing(false)
        }
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncResult(null)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, isSyncing, syncResult, pendingCount, checkPending }
}