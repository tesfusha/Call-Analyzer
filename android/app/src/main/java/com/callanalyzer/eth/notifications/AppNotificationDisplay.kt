package com.callanalyzer.eth.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.callanalyzer.eth.MainActivity
import com.callanalyzer.eth.R
import com.callanalyzer.eth.calllog.NotificationHelper
import org.json.JSONObject

object AppNotificationDisplay {
    const val EXTRA_NOTIFICATION_ID = "app_notif_id"
    const val EXTRA_ID_KEY = "app_notif_id_key"
    const val EXTRA_TITLE = "app_notif_title"
    const val EXTRA_BODY = "app_notif_body"
    const val EXTRA_CATEGORY = "app_notif_category"
    const val EXTRA_NUMBER = "app_notif_number"
    const val EXTRA_CONTACT_KEY = "app_notif_contact_key"
    const val EXTRA_EVENT_ID = "app_notif_event_id"
    const val EXTRA_MUTE_KEY = "app_notif_mute_key"
    const val EXTRA_WISH_TEXT = "app_notif_wish_text"
    const val EXTRA_OCCASION_TYPE = "app_notif_occasion_type"
    const val EXTRA_OCCASION_KEY = "app_notif_occasion_key"
    const val EXTRA_ACTION_ID = "app_notif_action_id"

    fun showNotification(
        context: Context,
        id: Int,
        idKey: String,
        title: String,
        body: String,
        category: String,
        number: String?,
        contactKey: String?,
        eventId: String?,
        muteKey: String?,
        wishText: String?,
        occasionType: String? = null,
        occasionKey: String? = null
    ): Boolean {
        val appContext = context.applicationContext
        NotificationHelper.ensureChannels(appContext)
        if (!NotificationHelper.canPostNotifications(appContext)) return false

        val isSchedule = category == "schedule"
        val isWishCategory = category == "birthday" || category == "holiday"
        val channelId = when {
            isSchedule -> NotificationHelper.CHANNEL_MISSED_CALL_REMINDERS
            isWishCategory -> NotificationHelper.CHANNEL_WISHES_AND_BIRTHDAYS
            else -> NotificationHelper.CHANNEL_GENERAL_ALERTS
        }
        val priority = if (isSchedule || isWishCategory) {
            NotificationCompat.PRIORITY_HIGH
        } else {
            NotificationCompat.PRIORITY_DEFAULT
        }
        val accentColor = when {
            isSchedule -> 0xFFE11D48.toInt()
            category == "birthday" -> 0xFFDB2777.toInt()
            category == "holiday" -> 0xFFD97706.toInt()
            else -> 0xFF059669.toInt()
        }

        val defaultTapActionId = if (isWishCategory) "wish" else "view"
        val viewPendingIntent = buildActivityActionPendingIntent(
            context = appContext,
            requestCode = requestCodeFor(id, 1),
            actionId = defaultTapActionId,
            id = id,
            idKey = idKey,
            title = title,
            body = body,
            category = category,
            number = number,
            contactKey = contactKey,
            eventId = eventId,
            muteKey = muteKey,
            wishText = wishText,
            occasionType = occasionType,
            occasionKey = occasionKey
        )

        val largeIcon = NotificationHelper.createInitialsAvatarBitmap(appContext, title, accentColor)

        val builder = NotificationCompat.Builder(appContext, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(largeIcon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setShowWhen(true)
            .setPriority(priority)
            .setDefaults(if (isSchedule) NotificationCompat.DEFAULT_ALL else NotificationCompat.DEFAULT_SOUND)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(if (isSchedule) NotificationCompat.CATEGORY_REMINDER else NotificationCompat.CATEGORY_EVENT)
            .setAutoCancel(true)
            .setContentIntent(viewPendingIntent)

        when (category) {
            "schedule" -> {
                if (!number.isNullOrBlank()) {
                    builder.addAction(
                        0,
                        "Call",
                        buildActivityActionPendingIntent(
                            appContext,
                            requestCodeFor(id, 2),
                            "call",
                            id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                        )
                    )
                }
                builder.addAction(
                    0,
                    "+15m",
                    buildBroadcastActionPendingIntent(
                        appContext,
                        requestCodeFor(id, 3),
                        "snooze_15m",
                        id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                    )
                )
                builder.addAction(
                    0,
                    "Clear",
                    buildBroadcastActionPendingIntent(
                        appContext,
                        requestCodeFor(id, 4),
                        "clear",
                        id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                    )
                )
            }

            "birthday", "holiday" -> {
                builder.addAction(
                    0,
                    "Send wish",
                    buildActivityActionPendingIntent(
                        appContext,
                        requestCodeFor(id, 5),
                        "wish",
                        id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                    )
                )
                builder.addAction(
                    0,
                    "Remind later",
                    buildBroadcastActionPendingIntent(
                        appContext,
                        requestCodeFor(id, 6),
                        "remind_later",
                        id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                    )
                )
                builder.addAction(
                    0,
                    "Dismiss",
                    buildBroadcastActionPendingIntent(
                        appContext,
                        requestCodeFor(id, 7),
                        "clear",
                        id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                    )
                )
            }

            else -> {
                builder.addAction(0, "View", viewPendingIntent)
                builder.addAction(
                    0,
                    "Dismiss",
                    buildBroadcastActionPendingIntent(
                        appContext,
                        requestCodeFor(id, 8),
                        "clear",
                        id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
                    )
                )
            }
        }

        return try {
            NotificationManagerCompat.from(appContext).notify(id, builder.build())
            true
        } catch (_: SecurityException) {
            false
        }
    }

    fun scheduleAlarm(context: Context, record: ScheduledNotificationRecord): String {
        val appContext = context.applicationContext
        val store = AppNotificationStore(appContext)
        store.upsertScheduled(record)

        val now = System.currentTimeMillis()
        if (record.triggerAtMs <= now + 500L) {
            store.removeScheduled(record.id)
            val shown = showNotification(
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
            return "immediate"
        }

        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return "unavailable"
        val pendingIntent = buildAlarmPendingIntent(appContext, record)
        val triggerAt = record.triggerAtMs.coerceAtLeast(now + 500L)

        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

        // User-scheduled call reminders use setAlarmClock() when exact alarms are allowed.
        // Unlike setExactAndAllowWhileIdle(), setAlarmClock() wakes the device out of Doze
        // BEFORE triggerAt and bypasses Samsung/Xiaomi/Tecno App Standby throttling.
        if (canExact && record.category == "schedule") {
            try {
                val showIntent = PendingIntent.getActivity(
                    appContext,
                    alarmShowRequestCode(record.id),
                    Intent(appContext, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val info = AlarmManager.AlarmClockInfo(triggerAt, showIntent)
                alarmManager.setAlarmClock(info, pendingIntent)
                return "alarm_clock"
            } catch (_: SecurityException) {
                // Fall through to exact/inexact fallback below
            } catch (_: Exception) {
                // Fall through to exact/inexact fallback below
            }
        }

        return try {
            if (canExact) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
                "exact"
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
                "inexact"
            }
        } catch (_: SecurityException) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            "inexact"
        }
    }

    fun cancel(context: Context, id: Int) {
        val appContext = context.applicationContext
        AppNotificationStore(appContext).removeScheduled(id)
        NotificationHelper.cancelNotification(appContext, id)

        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(appContext, AppNotificationAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            appContext,
            alarmRequestCode(id),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    fun rescheduleAll(context: Context) {
        val appContext = context.applicationContext
        val store = AppNotificationStore(appContext)
        val now = System.currentTimeMillis()
        for (record in store.getScheduledNotifications()) {
            // Drop expired reminders more than 24h in the past
            if (record.triggerAtMs < now - 24L * 3_600_000L) {
                store.removeScheduled(record.id)
                continue
            }
            scheduleAlarm(appContext, record)
        }
    }

    fun buildActionEventJson(
        actionId: String,
        notificationId: Int,
        idKey: String,
        title: String?,
        body: String?,
        category: String?,
        number: String?,
        contactKey: String?,
        eventId: String?,
        muteKey: String?,
        wishText: String?,
        timestamp: Long,
        handledNatively: Boolean,
        occasionType: String? = null,
        occasionKey: String? = null
    ): JSONObject = JSONObject().apply {
        put("actionId", actionId)
        put("notificationId", notificationId)
        put("idKey", idKey)
        put("title", title ?: JSONObject.NULL)
        put("body", body ?: JSONObject.NULL)
        put("category", category ?: "other")
        put("number", number ?: JSONObject.NULL)
        put("contactKey", contactKey ?: JSONObject.NULL)
        put("eventId", eventId ?: JSONObject.NULL)
        put("muteKey", muteKey ?: JSONObject.NULL)
        put("wishText", wishText ?: JSONObject.NULL)
        put("occasionType", occasionType ?: JSONObject.NULL)
        put("occasionKey", occasionKey ?: JSONObject.NULL)
        put("timestamp", timestamp)
        put("handledNatively", handledNatively)
    }

    private fun buildAlarmPendingIntent(context: Context, record: ScheduledNotificationRecord): PendingIntent {
        val intent = Intent(context, AppNotificationAlarmReceiver::class.java).apply {
            putExtrasFromPayload(
                actionId = "alarm",
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
        }
        return PendingIntent.getBroadcast(
            context,
            alarmRequestCode(record.id),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun alarmShowRequestCode(id: Int): Int {
        return 1_200_000 + kotlin.math.abs(id % 1_000_000)
    }

    private fun buildActivityActionPendingIntent(
        context: Context,
        requestCode: Int,
        actionId: String,
        id: Int,
        idKey: String,
        title: String,
        body: String,
        category: String,
        number: String?,
        contactKey: String?,
        eventId: String?,
        muteKey: String?,
        wishText: String?,
        occasionType: String?,
        occasionKey: String?
    ): PendingIntent {
        val intent = Intent(context, AppNotificationActionActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtrasFromPayload(
                actionId, id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
            )
        }
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildBroadcastActionPendingIntent(
        context: Context,
        requestCode: Int,
        actionId: String,
        id: Int,
        idKey: String,
        title: String,
        body: String,
        category: String,
        number: String?,
        contactKey: String?,
        eventId: String?,
        muteKey: String?,
        wishText: String?,
        occasionType: String?,
        occasionKey: String?
    ): PendingIntent {
        val intent = Intent(context, AppNotificationActionReceiver::class.java).apply {
            action = AppNotificationActionReceiver.ACTION_PREFIX + actionId
            putExtrasFromPayload(
                actionId, id, idKey, title, body, category, number, contactKey, eventId, muteKey, wishText, occasionType, occasionKey
            )
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun Intent.putExtrasFromPayload(
        actionId: String,
        id: Int,
        idKey: String,
        title: String,
        body: String,
        category: String,
        number: String?,
        contactKey: String?,
        eventId: String?,
        muteKey: String?,
        wishText: String?,
        occasionType: String?,
        occasionKey: String?
    ) {
        putExtra(EXTRA_ACTION_ID, actionId)
        putExtra(EXTRA_NOTIFICATION_ID, id)
        putExtra(EXTRA_ID_KEY, idKey)
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
        putExtra(EXTRA_CATEGORY, category)
        putExtra(EXTRA_NUMBER, number)
        putExtra(EXTRA_CONTACT_KEY, contactKey)
        putExtra(EXTRA_EVENT_ID, eventId)
        putExtra(EXTRA_MUTE_KEY, muteKey)
        putExtra(EXTRA_WISH_TEXT, wishText)
        putExtra(EXTRA_OCCASION_TYPE, occasionType)
        putExtra(EXTRA_OCCASION_KEY, occasionKey)
    }

    private fun alarmRequestCode(id: Int): Int {
        return 70_000 + kotlin.math.abs(id % 1_000_000)
    }

    private fun requestCodeFor(id: Int, slot: Int): Int {
        return (kotlin.math.abs(id % 90_000) * 16) + slot
    }
}
