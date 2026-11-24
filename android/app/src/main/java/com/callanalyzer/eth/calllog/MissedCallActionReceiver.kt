package com.callanalyzer.eth.calllog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class MissedCallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        if (intent.action != ACTION_DISMISS) return

        val callId = intent.getLongExtra(NotificationHelper.EXTRA_CALL_ID, -1L)
        val notificationId = intent.getIntExtra(NotificationHelper.EXTRA_NOTIFICATION_ID, -1)

        if (notificationId >= 0) {
            NotificationHelper.cancelNotification(context, notificationId)
        }
        if (callId > 0L) {
            val store = CallLogSyncStore(context)
            store.addNotifiedCallId(callId)
            store.removePendingAlarm(callId)
            NotificationHelper.refreshMissedCallSummary(context, store)
        }
    }

    companion object {
        const val ACTION_DISMISS = "com.callanalyzer.eth.action.DISMISS_MISSED_REMINDER"
    }
}
