package com.callanalyzer.eth.notifications

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.callanalyzer.eth.calllog.NotificationHelper
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import java.lang.ref.WeakReference

@CapacitorPlugin(
    name = "AppNotifications",
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")
    ]
)
class AppNotificationsPlugin : Plugin() {

    override fun load() {
        super.load()
        activeInstance = WeakReference(this)
        NotificationHelper.ensureChannels(context)
    }

    override fun handleOnResume() {
        super.handleOnResume()
        isResumed = true
    }

    override fun handleOnPause() {
        isResumed = false
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        isResumed = false
        if (activeInstance?.get() === this) {
            activeInstance = null
        }
        super.handleOnDestroy()
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        call.resolve(JSObject().put("state", resolvePermissionState()))
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (NotificationHelper.canPostNotifications(context)) {
                call.resolve(JSObject().put("state", "granted"))
                return
            }
            requestPermissionForAlias("notifications", call, "onNotificationsPermissionResult")
        } else {
            val state = if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                "granted"
            } else {
                "denied"
            }
            call.resolve(JSObject().put("state", state))
        }
    }

    @PermissionCallback
    private fun onNotificationsPermissionResult(call: PluginCall) {
        call.resolve(JSObject().put("state", resolvePermissionState()))
    }

    @PluginMethod
    fun showNotification(call: PluginCall) {
        val id = call.getInt("id") ?: ((System.currentTimeMillis() % 100_000L).toInt() + 100)
        val idKey = call.getString("idKey")?.takeIf { it.isNotBlank() } ?: id.toString()
        val title = call.getString("title")?.trim().orEmpty()
        val body = call.getString("body")?.trim().orEmpty()
        if (title.isEmpty()) {
            call.reject("Missing notification title.")
            return
        }

        val shown = AppNotificationDisplay.showNotification(
            context = context,
            id = id,
            idKey = idKey,
            title = title,
            body = body,
            category = call.getString("category")?.ifBlank { "other" } ?: "other",
            number = call.getString("number")?.takeIf { it.isNotBlank() },
            contactKey = call.getString("contactKey")?.takeIf { it.isNotBlank() },
            eventId = call.getString("eventId")?.takeIf { it.isNotBlank() },
            muteKey = call.getString("muteKey")?.takeIf { it.isNotBlank() },
            wishText = call.getString("wishText")?.takeIf { it.isNotBlank() },
            occasionType = call.getString("occasionType")?.takeIf { it.isNotBlank() },
            occasionKey = call.getString("occasionKey")?.takeIf { it.isNotBlank() }
        )

        if (shown) {
            call.resolve()
        } else {
            call.reject("Notifications permission not granted.")
        }
    }

    @PluginMethod
    fun scheduleNotification(call: PluginCall) {
        val id = call.getInt("id") ?: ((System.currentTimeMillis() % 100_000L).toInt() + 100)
        val idKey = call.getString("idKey")?.takeIf { it.isNotBlank() } ?: id.toString()
        val title = call.getString("title")?.trim().orEmpty()
        val body = call.getString("body")?.trim().orEmpty()
        val triggerAtMs = call.getDouble("triggerAtMs")?.toLong() ?: 0L

        if (title.isEmpty() || triggerAtMs <= 0L) {
            call.reject("Missing notification title or triggerAtMs.")
            return
        }

        val record = ScheduledNotificationRecord(
            id = id,
            idKey = idKey,
            title = title,
            body = body,
            triggerAtMs = triggerAtMs,
            category = call.getString("category")?.ifBlank { "schedule" } ?: "schedule",
            number = call.getString("number")?.takeIf { it.isNotBlank() },
            contactKey = call.getString("contactKey")?.takeIf { it.isNotBlank() },
            eventId = call.getString("eventId")?.takeIf { it.isNotBlank() },
            muteKey = call.getString("muteKey")?.takeIf { it.isNotBlank() },
            wishText = call.getString("wishText")?.takeIf { it.isNotBlank() },
            occasionType = call.getString("occasionType")?.takeIf { it.isNotBlank() },
            occasionKey = call.getString("occasionKey")?.takeIf { it.isNotBlank() }
        )

        AppNotificationDisplay.scheduleAlarm(context, record)
        call.resolve()
    }

    @PluginMethod
    fun cancelNotification(call: PluginCall) {
        val id = call.getInt("id")
        if (id != null && id >= 0) {
            AppNotificationDisplay.cancel(context, id)
        }
        call.resolve()
    }

    @PluginMethod
    fun getPendingActions(call: PluginCall) {
        val pending = AppNotificationStore(context).drainPendingActions()
        val out = JSArray()
        for (i in 0 until pending.length()) {
            val item = pending.optJSONObject(i) ?: continue
            out.put(JSObject.fromJSONObject(item))
        }
        call.resolve(JSObject().put("actions", out))
    }

    private fun resolvePermissionState(): String {
        val enabledInOs = NotificationManagerCompat.from(context).areNotificationsEnabled()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val runtimeGranted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (runtimeGranted) {
                return if (enabledInOs) "granted" else "denied"
            }
            return when (getPermissionState("notifications")) {
                PermissionState.GRANTED -> if (enabledInOs) "granted" else "denied"
                PermissionState.DENIED -> "denied"
                else -> "prompt"
            }
        }
        return if (enabledInOs) "granted" else "denied"
    }

    companion object {
        @Volatile
        private var activeInstance: WeakReference<AppNotificationsPlugin>? = null

        @Volatile
        private var isResumed: Boolean = false

        fun dispatchAction(context: Context, eventJson: JSONObject) {
            val plugin = activeInstance?.get()
            if (plugin != null && isResumed) {
                try {
                    val jsObj = JSObject.fromJSONObject(eventJson)
                    plugin.notifyListeners("notificationAction", jsObj)
                    return
                } catch (_: Exception) {
                    // Fall back to pending queue below
                }
            }
            AppNotificationStore(context.applicationContext).enqueuePendingAction(eventJson)
        }
    }
}
