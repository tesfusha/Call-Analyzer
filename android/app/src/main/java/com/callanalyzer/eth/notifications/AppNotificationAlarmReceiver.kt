package com.callanalyzer.eth.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.callanalyzer.eth.calllog.CallLogSyncStore
import com.callanalyzer.eth.calllog.NotificationHelper
import java.util.concurrent.Executors

class AppNotificationAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val id = intent.getIntExtra(AppNotificationDisplay.EXTRA_NOTIFICATION_ID, -1)
        if (id < 0) return

        val appContext = context.applicationContext
        val pendingResult = goAsync()
        executor.execute {
            try {
                val store = AppNotificationStore(appContext)
                val record = store.getScheduledById(id) ?: return@execute
                store.removeScheduled(id)

                val syncStore = CallLogSyncStore(appContext)
                if (NotificationHelper.isWithinQuietHours(syncStore)) {
                    return@execute
                }

                AppNotificationDisplay.showNotification(
                    context = appContext,
                    id = record.id,
                    idKey = record.idKey,
                    title = record.title,
                    body = record.body,
                    category = record.category,
                    number = record.number,
                    contactKey = record.contactKey,
                    eventId = record.eventId,
                    muteKey = record.muteKey,
                    wishText = record.wishText
                )
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
