package com.callanalyzer.eth.calllog

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.callanalyzer.eth.R
import com.callanalyzer.eth.notifications.AppNotificationActionActivity
import com.callanalyzer.eth.notifications.AppNotificationDisplay
import java.util.Calendar
import kotlin.math.max

object NotificationHelper {
    const val CHANNEL_MISSED_CALL_REMINDERS = "missed_call_reminders"
    const val CHANNEL_WISHES_AND_BIRTHDAYS = "wishes_and_birthdays"
    const val CHANNEL_GENERAL_ALERTS = "general_alerts"

    const val GROUP_MISSED_CALLS = "com.callanalyzer.eth.GROUP_MISSED_CALLS"
    private const val SUMMARY_ID_MISSED_CALLS = 29_999

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val missedChannel = NotificationChannel(
            CHANNEL_MISSED_CALL_REMINDERS,
            "Missed calls",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Follow-up reminders for missed calls and scheduled callbacks."
            enableLights(true)
            enableVibration(true)
        }

        val wishesChannel = NotificationChannel(
            CHANNEL_WISHES_AND_BIRTHDAYS,
            "Wishes and birthdays",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Birthday and Ethiopian holiday wish reminders."
            enableLights(true)
            enableVibration(true)
        }

        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL_ALERTS,
            "General",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Sync updates, milestones, and general alerts."
        }

        nm.createNotificationChannel(missedChannel)
        nm.createNotificationChannel(wishesChannel)
        nm.createNotificationChannel(generalChannel)
    }

    fun isWithinQuietHours(store: CallLogSyncStore): Boolean {
        if (!store.isQuietHoursEnabled()) return false
        val start = store.getQuietStartHour()
        val end = store.getQuietEndHour()
        if (start == end) return false
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return if (start < end) {
            hour in start until end
        } else {
            hour >= start || hour < end
        }
    }

    fun canPostNotifications(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    fun createInitialsAvatarBitmap(
        context: Context,
        label: String,
        accentColor: Int = 0xFF059669.toInt()
    ): Bitmap {
        val density = context.resources.displayMetrics.density
        val sizePx = (48f * density).toInt().coerceIn(96, 192)
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accentColor
            style = Paint.Style.FILL
        }
        val radius = sizePx / 2f
        canvas.drawCircle(radius, radius, radius, bgPaint)

        val initials = extractInitials(label)
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = sizePx * 0.40f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val bounds = Rect()
        textPaint.getTextBounds(initials, 0, initials.length, bounds)
        val textY = radius - bounds.exactCenterY()
        canvas.drawText(initials, radius, textY, textPaint)

        return bitmap
    }

    private fun extractInitials(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return "CA"
        val words = trimmed.split(Regex("\\s+")).filter { word ->
            word.any { it.isLetter() }
        }
        if (words.isNotEmpty()) {
            val first = words.first().firstOrNull { it.isLetter() }?.uppercaseChar() ?: 'C'
            val second = if (words.size > 1) {
                words.last().firstOrNull { it.isLetter() }?.uppercaseChar()
            } else {
                words.first().drop(1).firstOrNull { it.isLetter() }?.uppercaseChar()
            }
            return if (second != null) "$first$second" else "$first"
        }
        val digits = trimmed.filter { it.isDigit() }
        if (digits.length >= 2) {
            return digits.takeLast(2)
        }
        return digits.ifEmpty { "CA" }
    }

    fun showMissedCallReminder(
        context: Context,
        alarm: PendingMissedAlarm
    ): Boolean {
        ensureChannels(context)
        if (!canPostNotifications(context)) return false

        val label = alarm.displayName?.takeIf { it.isNotBlank() } ?: alarm.number
        val elapsedMinutes = max(1L, (System.currentTimeMillis() - alarm.callTimestampMs) / 60_000L)
        val bodyText = if (alarm.missedCount > 1) {
            "${alarm.missedCount} missed calls, last ${elapsedMinutes}m ago. Tap to view or call back."
        } else {
            "Missed call, $elapsedMinutes minute${if (elapsedMinutes == 1L) "" else "s"} ago. Tap to call back."
        }

        val viewIntent = Intent(context, AppNotificationActionActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(AppNotificationDisplay.EXTRA_ACTION_ID, "view")
            putExtra(AppNotificationDisplay.EXTRA_NOTIFICATION_ID, alarm.notificationId)
            putExtra(AppNotificationDisplay.EXTRA_ID_KEY, "missed_${alarm.callId}")
            putExtra(AppNotificationDisplay.EXTRA_TITLE, label)
            putExtra(AppNotificationDisplay.EXTRA_BODY, bodyText)
            putExtra(AppNotificationDisplay.EXTRA_CATEGORY, "other")
            putExtra(AppNotificationDisplay.EXTRA_NUMBER, alarm.number)
            putExtra(AppNotificationDisplay.EXTRA_CONTACT_KEY, alarm.normalizedNumber)
        }
        val viewPendingIntent = PendingIntent.getActivity(
            context,
            (alarm.callId.toInt() * 31) + 4,
            viewIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val callbackIntent = Intent(context, CallbackActionActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_CALL_ID, alarm.callId)
            putExtra(EXTRA_NOTIFICATION_ID, alarm.notificationId)
            putExtra(EXTRA_NUMBER, alarm.number)
        }
        val callbackPendingIntent = PendingIntent.getActivity(
            context,
            (alarm.callId.toInt() * 31) + 1,
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val dismissIntent = Intent(context, MissedCallActionReceiver::class.java).apply {
            action = MissedCallActionReceiver.ACTION_DISMISS
            putExtra(EXTRA_CALL_ID, alarm.callId)
            putExtra(EXTRA_NOTIFICATION_ID, alarm.notificationId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            (alarm.callId.toInt() * 31) + 2,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val deleteIntent = Intent(context, MissedCallActionReceiver::class.java).apply {
            action = MissedCallActionReceiver.ACTION_DISMISS
            putExtra(EXTRA_CALL_ID, alarm.callId)
            putExtra(EXTRA_NOTIFICATION_ID, alarm.notificationId)
        }
        val deletePendingIntent = PendingIntent.getBroadcast(
            context,
            (alarm.callId.toInt() * 31) + 3,
            deleteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val largeIcon = createInitialsAvatarBitmap(context, label, 0xFFE11D48.toInt())

        val builder = NotificationCompat.Builder(context, CHANNEL_MISSED_CALL_REMINDERS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(largeIcon)
            .setContentTitle(label)
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setWhen(alarm.callTimestampMs)
            .setShowWhen(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setGroup(GROUP_MISSED_CALLS)
            .setAutoCancel(true)
            .setContentIntent(viewPendingIntent)
            .setDeleteIntent(deletePendingIntent)
            .addAction(0, "Call back", callbackPendingIntent)
            .addAction(0, "Dismiss", dismissPendingIntent)

        return try {
            NotificationManagerCompat.from(context).notify(alarm.notificationId, builder.build())
            true
        } catch (_: SecurityException) {
            false
        }
    }

    fun refreshMissedCallSummary(context: Context, store: CallLogSyncStore) {
        if (!canPostNotifications(context)) return
        val shownAlarms = store.getPendingAlarms().filter { it.shown }
        if (shownAlarms.size < 2) {
            cancelNotification(context, SUMMARY_ID_MISSED_CALLS)
            return
        }

        val totalMissed = shownAlarms.sumOf { it.missedCount.coerceAtLeast(1) }
        val summaryTitle = "$totalMissed missed calls"
        val inboxStyle = NotificationCompat.InboxStyle().setBigContentTitle(summaryTitle)
        shownAlarms.takeLast(5).forEach { item ->
            val who = item.displayName?.takeIf { it.isNotBlank() } ?: item.number
            val suffix = if (item.missedCount > 1) " (${item.missedCount})" else ""
            inboxStyle.addLine("$who$suffix")
        }

        val summaryBuilder = NotificationCompat.Builder(context, CHANNEL_MISSED_CALL_REMINDERS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(summaryTitle)
            .setContentText("${shownAlarms.size} contacts waiting for a callback")
            .setStyle(inboxStyle)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setGroup(GROUP_MISSED_CALLS)
            .setGroupSummary(true)
            .setAutoCancel(true)

        try {
            NotificationManagerCompat.from(context).notify(SUMMARY_ID_MISSED_CALLS, summaryBuilder.build())
        } catch (_: SecurityException) {
            // Ignore summary notification permission errors
        }
    }

    fun cancelNotification(context: Context, notificationId: Int) {
        try {
            NotificationManagerCompat.from(context).cancel(notificationId)
        } catch (_: Exception) {
            // Ignore cancellation errors
        }
    }

    const val EXTRA_CALL_ID = "extra_call_id"
    const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
    const val EXTRA_NUMBER = "extra_number"
}
