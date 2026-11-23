package com.callanalyzer.eth.calllog

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object CallLogSyncEngine {
    private val lock = Any()

    /**
     * Evaluates new CallLog.Calls entries natively (works with the app closed/swiped away):
     * - Initializes the evaluation watermark on first run so historical missed calls don't trigger stale alerts.
     * - Cancels any pending alarm AND removes any already-shown notification when an outgoing call matches a pending missed number.
     * - Schedules an exact alarm for newly missed calls according to user's delay setting (5 or 10 min).
     * Never modifies `lastWebSyncedId`, so the web UI still receives all new calls on next open.
     */
    fun evaluateNewCalls(context: Context): Int {
        synchronized(lock) {
            if (!CallLogReader.hasReadCallLogPermission(context)) return 0

            val store = CallLogSyncStore(context)
            var lastEvalId = store.getLastAlertEvalId()

            if (lastEvalId < 0L) {
                // First native evaluation: seed watermark to current max call _ID so historical call logs don't spam alerts.
                val currentMax = CallLogReader.getMaxCallId(context)
                store.setLastAlertEvalId(currentMax)
                return 0
            }

            val newCalls = CallLogReader.queryCallsAfterId(context, afterId = lastEvalId, limit = 500)
            if (newCalls.isEmpty()) return 0

            val nowMs = System.currentTimeMillis()
            val delayMs = store.getDelayMinutes() * 60_000L
            val remindersEnabled = store.isReminderEnabled()

            for (call in newCalls) {
                if (call.rawId > lastEvalId) {
                    lastEvalId = call.rawId
                }

                if (call.direction == "outgoing" && call.normalizedNumber.isNotEmpty()) {
                    // Cancel any pending alarms OR dismiss notifications already shown for the same normalized number
                    val matchingPending = store.getPendingAlarms().filter { pending ->
                        pending.normalizedNumber == call.normalizedNumber &&
                            call.timestamp >= pending.callTimestampMs
                    }
                    for (pending in matchingPending) {
                        cancelAlarmAndNotification(context, store, pending)
                    }
                } else if (call.direction == "missed" && remindersEnabled && call.normalizedNumber.isNotEmpty()) {
                    // Only schedule if not already notified and the missed call occurred within the last 12 hours
                    if (!store.hasNotifiedCallId(call.rawId) && (nowMs - call.timestamp) <= 12L * 3_600_000L) {
                        val triggerAtMs = (call.timestamp + delayMs).coerceAtLeast(nowMs + 1_000L)
                        val alarm = PendingMissedAlarm(
                            callId = call.rawId,
                            number = call.number,
                            normalizedNumber = call.normalizedNumber,
                            displayName = call.name,
                            callTimestampMs = call.timestamp,
                            triggerAtMs = triggerAtMs,
                            notificationId = PendingMissedAlarm.notificationIdForCall(call.rawId),
                            shown = false
                        )
                        store.upsertPendingAlarm(alarm)
                        scheduleExactAlarm(context, alarm)
                    }
                }
            }

            store.setLastAlertEvalId(lastEvalId)
            return newCalls.size
        }
    }

    fun checkIfMissedCallReturned(context: Context, alarm: PendingMissedAlarm): Boolean {
        if (!CallLogReader.hasReadCallLogPermission(context)) return false
        val recent = CallLogReader.queryCallsAfterId(context, afterId = alarm.callId, limit = 500)
        return recent.any { call ->
            call.direction == "outgoing" &&
                call.normalizedNumber == alarm.normalizedNumber &&
                call.timestamp >= alarm.callTimestampMs
        }
    }

    fun markMissedCallReturnedByNumber(context: Context, rawNumber: String) {
        synchronized(lock) {
            val norm = PhoneNormalizer.normalize(rawNumber)
            if (norm.isEmpty()) return
            val store = CallLogSyncStore(context)
            val matching = store.getPendingAlarms().filter { it.normalizedNumber == norm }
            for (pending in matching) {
                cancelAlarmAndNotification(context, store, pending)
            }
        }
    }

    fun cancelAlarmAndNotification(
        context: Context,
        store: CallLogSyncStore,
        alarm: PendingMissedAlarm
    ) {
        cancelExactAlarm(context, alarm.callId)
        NotificationHelper.cancelNotification(context, alarm.notificationId)
        store.addReturnedCallId(alarm.callId)
        store.addNotifiedCallId(alarm.callId)
        store.removePendingAlarm(alarm.callId)
    }

    fun scheduleExactAlarm(context: Context, alarm: PendingMissedAlarm) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pendingIntent = buildAlarmPendingIntent(context, alarm)
        val triggerAt = alarm.triggerAtMs.coerceAtLeast(System.currentTimeMillis() + 500L)

        try {
            val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmManager.canScheduleExactAlarms()
            } else {
                true
            }
            if (canExact) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            }
        } catch (_: SecurityException) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        }
    }

    fun cancelExactAlarm(context: Context, callId: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, MissedCallAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCodeForCall(callId),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    fun reschedulePendingAlarms(context: Context) {
        synchronized(lock) {
            val store = CallLogSyncStore(context)
            if (!store.isReminderEnabled()) return
            val nowMs = System.currentTimeMillis()
            val pending = store.getPendingAlarms()
            for (alarm in pending) {
                if (alarm.shown) continue
                // Drop stale alarms older than 24 hours
                if (nowMs - alarm.callTimestampMs > 24L * 3_600_000L) {
                    store.removePendingAlarm(alarm.callId)
                    continue
                }
                if (checkIfMissedCallReturned(context, alarm)) {
                    cancelAlarmAndNotification(context, store, alarm)
                    continue
                }
                val nextTrigger = if (alarm.triggerAtMs <= nowMs) nowMs + 2_000L else alarm.triggerAtMs
                scheduleExactAlarm(context, alarm.copy(triggerAtMs = nextTrigger))
            }
        }
    }

    private fun buildAlarmPendingIntent(context: Context, alarm: PendingMissedAlarm): PendingIntent {
        val intent = Intent(context, MissedCallAlarmReceiver::class.java).apply {
            putExtra(NotificationHelper.EXTRA_CALL_ID, alarm.callId)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCodeForCall(alarm.callId),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun requestCodeForCall(callId: Long): Int = 50_000 + kotlin.math.abs((callId % 1_000_000L).toInt())
}
