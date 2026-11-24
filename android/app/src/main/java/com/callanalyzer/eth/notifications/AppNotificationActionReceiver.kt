package com.callanalyzer.eth.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.callanalyzer.eth.calllog.NotificationHelper

class AppNotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val appContext = context.applicationContext

        val actionId = intent.getStringExtra(AppNotificationDisplay.EXTRA_ACTION_ID) ?: return
        val id = intent.getIntExtra(AppNotificationDisplay.EXTRA_NOTIFICATION_ID, -1)
        val idKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_ID_KEY) ?: id.toString()
        val title = intent.getStringExtra(AppNotificationDisplay.EXTRA_TITLE)
        val body = intent.getStringExtra(AppNotificationDisplay.EXTRA_BODY)
        val category = intent.getStringExtra(AppNotificationDisplay.EXTRA_CATEGORY) ?: "other"
        val number = intent.getStringExtra(AppNotificationDisplay.EXTRA_NUMBER)
        val contactKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_CONTACT_KEY)
        val eventId = intent.getStringExtra(AppNotificationDisplay.EXTRA_EVENT_ID)
        val muteKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_MUTE_KEY)
        val wishText = intent.getStringExtra(AppNotificationDisplay.EXTRA_WISH_TEXT)
        val occasionType = intent.getStringExtra(AppNotificationDisplay.EXTRA_OCCASION_TYPE)
        val occasionKey = intent.getStringExtra(AppNotificationDisplay.EXTRA_OCCASION_KEY)

        if (id >= 0) {
            NotificationHelper.cancelNotification(appContext, id)
        }

        val nowMs = System.currentTimeMillis()
        var handledNatively = false

        when (actionId) {
            "snooze_15m", "snooze_60m" -> {
                val mins = if (actionId == "snooze_60m") 60L else 15L
                if (id >= 0 && !title.isNullOrBlank()) {
                    val triggerAtMs = nowMs + mins * 60_000L
                    AppNotificationDisplay.scheduleAlarm(
                        appContext,
                        ScheduledNotificationRecord(
                            id = id,
                            idKey = idKey,
                            title = title,
                            body = body ?: "",
                            triggerAtMs = triggerAtMs,
                            category = category,
                            number = number,
                            contactKey = contactKey,
                            eventId = eventId,
                            muteKey = muteKey,
                            wishText = wishText,
                            occasionType = occasionType,
                            occasionKey = occasionKey
                        )
                    )
                    handledNatively = true
                }
            }

            "remind_later" -> {
                if (id >= 0 && !title.isNullOrBlank()) {
                    val triggerAtMs = nowMs + 2L * 3_600_000L
                    AppNotificationDisplay.scheduleAlarm(
                        appContext,
                        ScheduledNotificationRecord(
                            id = id,
                            idKey = idKey,
                            title = title,
                            body = body ?: "",
                            triggerAtMs = triggerAtMs,
                            category = category,
                            number = number,
                            contactKey = contactKey,
                            eventId = eventId,
                            muteKey = muteKey,
                            wishText = wishText,
                            occasionType = occasionType,
                            occasionKey = occasionKey
                        )
                    )
                    handledNatively = true
                }
            }

            "clear", "mute" -> {
                if (id >= 0) {
                    AppNotificationDisplay.cancel(appContext, id)
                }
            }
        }

        val eventJson = AppNotificationDisplay.buildActionEventJson(
            actionId = actionId,
            notificationId = id,
            idKey = idKey,
            title = title,
            body = body,
            category = category,
            number = number,
            contactKey = contactKey,
            eventId = eventId,
            muteKey = muteKey,
            wishText = wishText,
            timestamp = nowMs,
            handledNatively = handledNatively,
            occasionType = occasionType,
            occasionKey = occasionKey
        )
        AppNotificationsPlugin.dispatchAction(appContext, eventJson)
    }

    companion object {
        const val ACTION_PREFIX = "com.callanalyzer.eth.notif.action."
    }
}
