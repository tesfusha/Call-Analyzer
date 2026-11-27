package com.callanalyzer.eth.calllog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import java.util.concurrent.Executors

class MissedCallAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val callId = intent.getLongExtra(NotificationHelper.EXTRA_CALL_ID, -1L)
        if (callId <= 0L) return

        val appContext = context.applicationContext
        val wakeLock = try {
            val pm = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "callanalyzer:MissedCallAlarm")?.apply {
                setReferenceCounted(false)
                acquire(15_000L)
            }
        } catch (_: Exception) {
            null
        }
        val pendingResult = goAsync()
        executor.execute {
            try {
                handleAlarm(appContext, callId)
            } finally {
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock.release()
                    }
                } catch (_: Exception) {
                    // Ignore wake lock release errors
                }
                pendingResult.finish()
            }
        }
    }

    private fun handleAlarm(context: Context, callId: Long) {
        val store = CallLogSyncStore(context)
        if (!store.isReminderEnabled()) {
            store.removePendingAlarm(callId)
            return
        }

        val alarm = store.getPendingAlarms().find { it.callId == callId } ?: return
        if (alarm.shown || store.hasNotifiedCallId(callId)) {
            return
        }

        // Re-check CallLog.Calls in case an outgoing call happened while app was closed
        if (CallLogSyncEngine.checkIfMissedCallReturned(context, alarm)) {
            CallLogSyncEngine.cancelAlarmAndNotification(context, store, alarm)
            return
        }

        // Respect quiet hours setting
        if (NotificationHelper.isWithinQuietHours(store)) {
            store.addNotifiedCallId(callId)
            store.removePendingAlarm(callId)
            return
        }

        val shown = NotificationHelper.showMissedCallReminder(context, alarm)
        if (shown) {
            store.markAlarmShown(callId)
            store.addNotifiedCallId(callId)
            NotificationHelper.refreshMissedCallSummary(context, store)
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
