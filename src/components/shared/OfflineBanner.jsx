import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react'

const OfflineBanner = () => {
  const { isOnline, isSyncing, syncResult, pendingCount } = useOnlineStatus()

  if (isOnline && !isSyncing && !syncResult) {
    // Show pending count warning if there's unsynced data
    if (pendingCount > 0) {
      return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi size={14} className="text-amber-500" />
            <span className="text-xs text-amber-700 font-medium">
              {pendingCount} record{pendingCount > 1 ? 's' : ''} waiting to sync
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  if (isSyncing) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2">
        <RefreshCw size={14} className="text-blue-500 animate-spin" />
        <span className="text-xs text-blue-700 font-medium">
          Syncing your offline data...
        </span>
      </div>
    )
  }

  if (syncResult && syncResult.errors.length === 0) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center gap-2">
        <CheckCircle size={14} className="text-green-500" />
        <span className="text-xs text-green-700 font-medium">
          ✅ Synced successfully —
          {syncResult.attendance > 0 && ` ${syncResult.attendance} attendance records`}
          {syncResult.grades > 0 && ` ${syncResult.grades} grade records`}
        </span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff size={14} className="text-gray-300" />
          <span className="text-xs text-gray-200 font-medium">
            You are offline — changes will sync when connected
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">
            {pendingCount} pending
          </span>
        )}
      </div>
    )
  }

  return null
}

export default OfflineBanner