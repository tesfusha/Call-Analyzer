package com.callanalyzer.eth.calllog

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.callanalyzer.eth.R
import java.util.Calendar

object NotificationHelper {
    const val CHANNEL_MISSED_CALL_REMINDERS = "missed_call_reminders"
    const val CHANNEL_GENERAL_ALERTS = "general_alerts"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val missedChannel = NotificationChannel(
            CHANNEL_MISSED_CALL_REMINDERS,
            "Missed-Call Reminders",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Follow-up reminders for missed calls that have not been returned."
            enableLights(true)
            enableVibration(true)
        }

        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL_ALERTS,
            "General Alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Sync updates, scheduled reminders, and general alerts."
        }

        nm.createNotificationChannel(missedChannel)
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

    fun showMissedCallReminder(
        context: Context,
        alarm: PendingMissedAlarm
    ): Boolean {
        ensureChannels(context)
        if (!canPostNotifications(context)) return false

        val label = alarm.displayName?.takeIf { it.isNotBlank() } ?: alarm.number
        val bodyText = "Missed call from $label. Call back?"

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

        val builder = NotificationCompat.Builder(context, CHANNEL_MISSED_CALL_REMINDERS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Missed Call Reminder")
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(callbackPendingIntent)
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
