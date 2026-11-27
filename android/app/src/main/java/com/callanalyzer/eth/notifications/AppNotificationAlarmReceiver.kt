package com.callanalyzer.eth.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import com.callanalyzer.eth.calllog.CallLogSyncStore
import com.callanalyzer.eth.calllog.NotificationHelper
import java.util.concurrent.Executors

class AppNotificationAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val id = intent.getIntExtra(AppNotificationDisplay.EXTRA_NOTIFICATION_ID, -1)
        if (id < 0) return

        val appContext = context.applicationContext
        val wakeLock = acquireShortWakeLock(appContext)
        val pendingResult = goAsync()
        executor.execute {
            try {
                val store = AppNotificationStore(appContext)
                val storedRecord = store.getScheduledById(id)
                store.removeScheduled(id)

                val record = storedRecord ?: buildRecordFromIntent(id, intent) ?: return@execute

                // Explicit user-scheduled call reminders ("schedule") must always fire at the
                // exact time the user chose. Quiet hours only mute automatic background alerts.
                if (record.category != "schedule") {
                    val syncStore = CallLogSyncStore(appContext)
                    if (NotificationHelper.isWithinQuietHours(syncStore)) {
                        return@execute
                    }
                }

                val shown = AppNotificationDisplay.showNotification(
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
                    wishText = record.wishText,
                    occasionType = record.occasionType,
                    occasionKey = record.occasionKey
                )
                if (shown) {
                    store.markDelivered(record.idKey)
                }
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

    private fun buildRecordFromIntent(id: Int, intent: Intent): ScheduledNotificationRecord? {
        val title = intent.getStringExtra(AppNotificationDisplay.EXTRA_TITLE)?.trim().orEmpty()
        if (title.isEmpty()) return null
        return ScheduledNotificationRecord(
            id = id,
            idKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_ID_KEY)?.takeIf { it.isNotBlank() } ?: id.toString(),
            title = title,
            body = intent.getStringExtra(AppNotificationDisplay.EXTRA_BODY)?.trim().orEmpty(),
            triggerAtMs = System.currentTimeMillis(),
            category = intent.getStringExtra(AppNotificationDisplay.EXTRA_CATEGORY)?.ifBlank { "schedule" } ?: "schedule",
            number = intent.getStringExtra(AppNotificationDisplay.EXTRA_NUMBER)?.takeIf { it.isNotBlank() },
            contactKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_CONTACT_KEY)?.takeIf { it.isNotBlank() },
            eventId = intent.getStringExtra(AppNotificationDisplay.EXTRA_EVENT_ID)?.takeIf { it.isNotBlank() },
            muteKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_MUTE_KEY)?.takeIf { it.isNotBlank() },
            wishText = intent.getStringExtra(AppNotificationDisplay.EXTRA_WISH_TEXT)?.takeIf { it.isNotBlank() },
            occasionType = intent.getStringExtra(AppNotificationDisplay.EXTRA_OCCASION_TYPE)?.takeIf { it.isNotBlank() },
            occasionKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_OCCASION_KEY)?.takeIf { it.isNotBlank() }
        )
    }

    private fun acquireShortWakeLock(context: Context): PowerManager.WakeLock? {
        return try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return null
            pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "callanalyzer:ReminderAlarm").apply {
                setReferenceCounted(false)
                acquire(15_000L)
            }
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
