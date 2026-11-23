package com.callanalyzer.eth.calllog

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class CallbackActionActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val callId = intent?.getLongExtra(NotificationHelper.EXTRA_CALL_ID, -1L) ?: -1L
        val notificationId = intent?.getIntExtra(NotificationHelper.EXTRA_NOTIFICATION_ID, -1) ?: -1
        val number = intent?.getStringExtra(NotificationHelper.EXTRA_NUMBER)?.trim().orEmpty()

        if (notificationId >= 0) {
            NotificationHelper.cancelNotification(this, notificationId)
        }

        val store = CallLogSyncStore(this)
        if (callId > 0L) {
            store.addNotifiedCallId(callId)
            store.addReturnedCallId(callId)
            store.removePendingAlarm(callId)
        }
        if (number.isNotEmpty()) {
            CallLogSyncEngine.markMissedCallReturnedByNumber(this, number)
            val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(number)}")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            try {
                startActivity(dialIntent)
            } catch (_: Exception) {
                // Ignore if no dialer activity is available
            }
        }

        finish()
    }
}
