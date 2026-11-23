package com.callanalyzer.eth.calllog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors

class MissedCallAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val callId = intent.getLongExtra(NotificationHelper.EXTRA_CALL_ID, -1L)
        if (callId <= 0L) return

        val appContext = context.applicationContext
        val pendingResult = goAsync()
        executor.execute {
            try {
                handleAlarm(appContext, callId)
            } finally {
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
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
