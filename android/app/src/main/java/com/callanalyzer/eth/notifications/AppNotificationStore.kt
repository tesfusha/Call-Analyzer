package com.callanalyzer.eth.notifications

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class ScheduledNotificationRecord(
    val id: Int,
    val idKey: String,
    val title: String,
    val body: String,
    val triggerAtMs: Long,
    val category: String,
    val number: String?,
    val contactKey: String?,
    val eventId: String?,
    val muteKey: String?,
    val wishText: String?
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("idKey", idKey)
        put("title", title)
        put("body", body)
        put("triggerAtMs", triggerAtMs)
        put("category", category)
        put("number", number ?: JSONObject.NULL)
        put("contactKey", contactKey ?: JSONObject.NULL)
        put("eventId", eventId ?: JSONObject.NULL)
        put("muteKey", muteKey ?: JSONObject.NULL)
        put("wishText", wishText ?: JSONObject.NULL)
    }

    companion object {
        private fun optNullableString(obj: JSONObject, key: String): String? {
            if (obj.isNull(key)) return null
            val raw = obj.optString(key, "").trim()
            return raw.ifEmpty { null }
        }

        fun fromJson(obj: JSONObject): ScheduledNotificationRecord? {
            val id = obj.optInt("id", -1)
            val title = obj.optString("title", "").trim()
            val body = obj.optString("body", "").trim()
            val triggerAtMs = obj.optLong("triggerAtMs", 0L)
            if (id < 0 || title.isEmpty() || triggerAtMs <= 0L) return null

            return ScheduledNotificationRecord(
                id = id,
                idKey = obj.optString("idKey", id.toString()).ifBlank { id.toString() },
                title = title,
                body = body,
                triggerAtMs = triggerAtMs,
                category = obj.optString("category", "other").ifBlank { "other" },
                number = optNullableString(obj, "number"),
                contactKey = optNullableString(obj, "contactKey"),
                eventId = optNullableString(obj, "eventId"),
                muteKey = optNullableString(obj, "muteKey"),
                wishText = optNullableString(obj, "wishText")
            )
        }
    }
}

class AppNotificationStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun getScheduledNotifications(): List<ScheduledNotificationRecord> {
        val raw = prefs.getString(KEY_SCHEDULED, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            val list = mutableListOf<ScheduledNotificationRecord>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                ScheduledNotificationRecord.fromJson(obj)?.let { list.add(it) }
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun upsertScheduled(record: ScheduledNotificationRecord) {
        val remaining = getScheduledNotifications().filterNot { it.id == record.id }.toMutableList()
        remaining.add(record)
        val capped = if (remaining.size > 200) remaining.takeLast(200) else remaining
        saveScheduledList(capped)
    }

    @Synchronized
    fun getScheduledById(id: Int): ScheduledNotificationRecord? {
        return getScheduledNotifications().find { it.id == id }
    }

    @Synchronized
    fun removeScheduled(id: Int) {
        val remaining = getScheduledNotifications().filterNot { it.id == id }
        saveScheduledList(remaining)
    }

    @Synchronized
    fun enqueuePendingAction(action: JSONObject) {
        val current = readPendingArray()
        current.put(action)
        val capped = if (current.length() > 50) {
            val trimmed = JSONArray()
            val start = current.length() - 50
            for (i in start until current.length()) {
                trimmed.put(current.get(i))
            }
            trimmed
        } else {
            current
        }
        prefs.edit().putString(KEY_PENDING_ACTIONS, capped.toString()).apply()
    }

    @Synchronized
    fun drainPendingActions(): JSONArray {
        val current = readPendingArray()
        if (current.length() > 0) {
            prefs.edit().remove(KEY_PENDING_ACTIONS).apply()
        }
        return current
    }

    private fun saveScheduledList(list: List<ScheduledNotificationRecord>) {
        val arr = JSONArray()
        list.forEach { arr.put(it.toJson()) }
        prefs.edit().putString(KEY_SCHEDULED, arr.toString()).apply()
    }

    private fun readPendingArray(): JSONArray {
        val raw = prefs.getString(KEY_PENDING_ACTIONS, null) ?: return JSONArray()
        return try {
            JSONArray(raw)
        } catch (_: Exception) {
            JSONArray()
        }
    }

    companion object {
        private const val PREFS_NAME = "app_notifications_store"
        private const val KEY_SCHEDULED = "scheduled_notifications"
        private const val KEY_PENDING_ACTIONS = "pending_notification_actions"
    }
}
