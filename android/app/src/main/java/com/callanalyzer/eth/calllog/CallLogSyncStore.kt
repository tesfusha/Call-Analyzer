package com.callanalyzer.eth.calllog

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

data class PendingMissedAlarm(
    val callId: Long,
    val number: String,
    val normalizedNumber: String,
    val displayName: String?,
    val callTimestampMs: Long,
    val triggerAtMs: Long,
    val notificationId: Int,
    val shown: Boolean = false
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("callId", callId)
        put("number", number)
        put("normalizedNumber", normalizedNumber)
        put("displayName", displayName ?: JSONObject.NULL)
        put("callTimestampMs", callTimestampMs)
        put("triggerAtMs", triggerAtMs)
        put("notificationId", notificationId)
        put("shown", shown)
    }

    companion object {
        fun fromJson(obj: JSONObject): PendingMissedAlarm? {
            val callId = obj.optLong("callId", -1L)
            val number = obj.optString("number", "").trim()
            if (callId <= 0L || number.isEmpty()) return null
            val norm = obj.optString("normalizedNumber", "").ifBlank { PhoneNormalizer.normalize(number) }
            val rawName = if (obj.isNull("displayName")) null else obj.optString("displayName", "").ifBlank { null }
            return PendingMissedAlarm(
                callId = callId,
                number = number,
                normalizedNumber = norm,
                displayName = rawName,
                callTimestampMs = obj.optLong("callTimestampMs", 0L),
                triggerAtMs = obj.optLong("triggerAtMs", 0L),
                notificationId = obj.optInt("notificationId", notificationIdForCall(callId)),
                shown = obj.optBoolean("shown", false)
            )
        }

        fun notificationIdForCall(callId: Long): Int {
            return 30_000 + abs((callId % 1_000_000L).toInt())
        }
    }
}

class CallLogSyncStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getLastWebSyncedId(): Long = prefs.getLong(KEY_LAST_WEB_SYNCED_ID, 0L)

    fun setLastWebSyncedId(id: Long) {
        if (id > getLastWebSyncedId()) {
            prefs.edit().putLong(KEY_LAST_WEB_SYNCED_ID, id).apply()
        }
    }

    fun resetLastWebSyncedId() {
        prefs.edit().putLong(KEY_LAST_WEB_SYNCED_ID, 0L).apply()
    }

    fun getLastAlertEvalId(): Long = prefs.getLong(KEY_LAST_ALERT_EVAL_ID, -1L)

    fun setLastAlertEvalId(id: Long) {
        if (id > getLastAlertEvalId()) {
            prefs.edit().putLong(KEY_LAST_ALERT_EVAL_ID, id).apply()
        }
    }

    fun isReminderEnabled(): Boolean = prefs.getBoolean(KEY_REMINDER_ENABLED, true)

    fun getDelayMinutes(): Int {
        val v = prefs.getInt(KEY_DELAY_MINUTES, 5)
        return if (v == 10) 10 else 5
    }

    fun isQuietHoursEnabled(): Boolean = prefs.getBoolean(KEY_QUIET_HOURS_ENABLED, false)

    fun getQuietStartHour(): Int = prefs.getInt(KEY_QUIET_START_HOUR, 22).coerceIn(0, 23)

    fun getQuietEndHour(): Int = prefs.getInt(KEY_QUIET_END_HOUR, 7).coerceIn(0, 23)

    fun updateSettings(
        reminderEnabled: Boolean,
        delayMinutes: Int,
        quietHoursEnabled: Boolean,
        quietStartHour: Int,
        quietEndHour: Int
    ) {
        val safeDelay = if (delayMinutes == 10) 10 else 5
        prefs.edit()
            .putBoolean(KEY_REMINDER_ENABLED, reminderEnabled)
            .putInt(KEY_DELAY_MINUTES, safeDelay)
            .putBoolean(KEY_QUIET_HOURS_ENABLED, quietHoursEnabled)
            .putInt(KEY_QUIET_START_HOUR, quietStartHour.coerceIn(0, 23))
            .putInt(KEY_QUIET_END_HOUR, quietEndHour.coerceIn(0, 23))
            .apply()
    }

    fun getPendingAlarms(): List<PendingMissedAlarm> {
        val raw = prefs.getString(KEY_PENDING_ALARMS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            val list = mutableListOf<PendingMissedAlarm>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                PendingMissedAlarm.fromJson(obj)?.let { list.add(it) }
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun savePendingAlarms(alarms: List<PendingMissedAlarm>) {
        // Keep up to the most recent 100 pending/shown reminders
        val capped = if (alarms.size > 100) alarms.takeLast(100) else alarms
        val arr = JSONArray()
        capped.forEach { arr.put(it.toJson()) }
        prefs.edit().putString(KEY_PENDING_ALARMS, arr.toString()).apply()
    }

    fun upsertPendingAlarm(alarm: PendingMissedAlarm) {
        val current = getPendingAlarms().filterNot { it.callId == alarm.callId }.toMutableList()
        current.add(alarm)
        savePendingAlarms(current)
    }

    fun markAlarmShown(callId: Long) {
        val updated = getPendingAlarms().map {
            if (it.callId == callId) it.copy(shown = true) else it
        }
        savePendingAlarms(updated)
    }

    fun removePendingAlarm(callId: Long) {
        val remaining = getPendingAlarms().filterNot { it.callId == callId }
        savePendingAlarms(remaining)
    }

    fun hasNotifiedCallId(callId: Long): Boolean {
        return getNotifiedCallIds().contains(callId)
    }

    fun addNotifiedCallId(callId: Long) {
        val list = getNotifiedCallIds().toMutableList()
        if (!list.contains(callId)) {
            list.add(callId)
        }
        val capped = if (list.size > 300) list.takeLast(300) else list
        val arr = JSONArray()
        capped.forEach { arr.put(it) }
        prefs.edit().putString(KEY_NOTIFIED_CALL_IDS, arr.toString()).apply()
    }

    private fun getNotifiedCallIds(): List<Long> {
        val raw = prefs.getString(KEY_NOTIFIED_CALL_IDS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i ->
                val v = arr.optLong(i, -1L)
                if (v > 0L) v else null
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun addReturnedCallId(callId: Long) {
        val list = getReturnedCallIds().toMutableList()
        val strId = "android_$callId"
        if (!list.contains(strId)) {
            list.add(strId)
        }
        val capped = if (list.size > 300) list.takeLast(300) else list
        val arr = JSONArray()
        capped.forEach { arr.put(it) }
        prefs.edit().putString(KEY_RETURNED_CALL_IDS, arr.toString()).apply()
    }

    fun getReturnedCallIds(): List<String> {
        val raw = prefs.getString(KEY_RETURNED_CALL_IDS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i ->
                arr.optString(i, "").ifBlank { null }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    companion object {
        private const val PREFS_NAME = "call_log_sync_store"
        private const val KEY_LAST_WEB_SYNCED_ID = "last_web_synced_id"
        private const val KEY_LAST_ALERT_EVAL_ID = "last_alert_eval_id"
        private const val KEY_REMINDER_ENABLED = "missed_reminder_enabled"
        private const val KEY_DELAY_MINUTES = "missed_reminder_delay_minutes"
        private const val KEY_QUIET_HOURS_ENABLED = "quiet_hours_enabled"
        private const val KEY_QUIET_START_HOUR = "quiet_start_hour"
        private const val KEY_QUIET_END_HOUR = "quiet_end_hour"
        private const val KEY_PENDING_ALARMS = "pending_missed_alarms"
        private const val KEY_NOTIFIED_CALL_IDS = "notified_call_ids"
        private const val KEY_RETURNED_CALL_IDS = "returned_call_ids"
    }
}
