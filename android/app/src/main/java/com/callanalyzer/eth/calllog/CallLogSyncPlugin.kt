package com.callanalyzer.eth.calllog

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.Settings
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.lang.ref.WeakReference
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "CallLogSync",
    permissions = [
        Permission(strings = [Manifest.permission.READ_CALL_LOG], alias = "callLog"),
        Permission(strings = [Manifest.permission.READ_PHONE_STATE], alias = "phoneState"),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")
    ]
)
class CallLogSyncPlugin : Plugin() {
    private var callLogObserver: ContentObserver? = null
    private val syncExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    override fun load() {
        super.load()
        activeInstance = WeakReference(this)
        NotificationHelper.ensureChannels(context)
        CallLogSyncWorker.ensurePeriodicWork(context)
    }

    override fun handleOnDestroy() {
        unregisterObserver()
        syncExecutor.shutdown()
        if (activeInstance?.get() === this) {
            activeInstance = null
        }
        super.handleOnDestroy()
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        call.resolve(buildPermissionStatusJson())
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val aliases = mutableListOf("callLog", "phoneState")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            aliases.add("notifications")
        }
        requestPermissionForAliases(aliases.toTypedArray(), call, "onAllPermissionsResult")
    }

    @PermissionCallback
    private fun onAllPermissionsResult(call: PluginCall) {
        if (CallLogReader.hasReadCallLogPermission(context)) {
            CallLogSyncWorker.ensurePeriodicWork(context)
            CallLogSyncEngine.evaluateNewCalls(context)
        }
        call.resolve(buildPermissionStatusJson())
    }

    @PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        var opened = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                context.startActivity(intent)
                opened = true
            } catch (_: Exception) {
                opened = OemSettingsHelper.openAppDetailsSettings(context)
            }
        }
        call.resolve(JSObject().put("opened", opened))
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        val opened = OemSettingsHelper.openBatteryOptimizationSettings(context)
        call.resolve(JSObject().put("opened", opened))
    }

    @PluginMethod
    fun openAutostartSettings(call: PluginCall) {
        val opened = OemSettingsHelper.openAutostartSettings(context)
        call.resolve(JSObject().put("opened", opened))
    }

    @PluginMethod
    fun getDeviceBrandInfo(call: PluginCall) {
        val info = OemSettingsHelper.getDeviceBrandInfo(context)
        call.resolve(JSObject.fromJSONObject(info))
    }

    @PluginMethod
    fun syncCallLog(call: PluginCall) {
        if (!CallLogReader.hasReadCallLogPermission(context)) {
            call.reject("READ_CALL_LOG permission not granted.")
            return
        }

        val appContext = context.applicationContext
        val fullResync = call.getBoolean("fullResync") ?: false
        val explicitSinceId = call.getDouble("sinceId")?.toLong()
        val beforeId = call.getDouble("beforeId")?.toLong()?.takeIf { it > 0L }
        val requestedLimit = call.getInt("limit")

        syncExecutor.execute {
            try {
                val store = CallLogSyncStore(appContext)

                // Run missed-call background evaluation on the first page (when beforeId is null)
                if (beforeId == null) {
                    CallLogSyncEngine.evaluateNewCalls(appContext)
                }

                val lastWebId = when {
                    fullResync -> 0L
                    explicitSinceId != null && explicitSinceId >= 0L -> explicitSinceId
                    else -> store.getLastWebSyncedId()
                }

                val pageLimit = when {
                    requestedLimit == null -> DEFAULT_SYNC_PAGE_SIZE
                    requestedLimit <= 0 -> null
                    else -> requestedLimit.coerceAtMost(5000)
                }

                val queryLimit = pageLimit?.plus(1)
                val queriedDesc = CallLogReader.queryCallsAfterId(
                    context = appContext,
                    afterId = lastWebId,
                    limit = queryLimit,
                    beforeId = beforeId
                ).sortedByDescending { it.rawId }

                val hasMore = pageLimit != null && queriedDesc.size > pageLimit
                val pageEntries = if (hasMore && pageLimit != null) {
                    queriedDesc.take(pageLimit)
                } else {
                    queriedDesc
                }

                val callsArr = JSArray()
                var maxCallId = lastWebId
                var minCallId = Long.MAX_VALUE
                for (entry in pageEntries) {
                    callsArr.put(entry.toJson())
                    if (entry.rawId > maxCallId) {
                        maxCallId = entry.rawId
                    }
                    if (entry.rawId < minCallId) {
                        minCallId = entry.rawId
                    }
                }
                if (minCallId == Long.MAX_VALUE) {
                    minCallId = 0L
                }

                val returnedArr = JSArray()
                if (beforeId == null) {
                    for (returnedId in store.getReturnedCallIds()) {
                        returnedArr.put(returnedId)
                    }
                }

                val res = JSObject().apply {
                    put("calls", callsArr)
                    put("returnedCallIds", returnedArr)
                    put("lastWebSyncedId", lastWebId)
                    put("maxCallId", maxCallId)
                    put("minCallId", minCallId)
                    put("hasMore", hasMore)
                }
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read Android call log: ${e.message ?: "Unknown error"}")
            }
        }
    }

    @PluginMethod
    fun acknowledgeSyncedCalls(call: PluginCall) {
        val maxCallId = call.getDouble("maxCallId")?.toLong() ?: 0L
        val reset = call.getBoolean("reset") ?: false
        val store = CallLogSyncStore(context)
        if (reset) {
            store.resetLastWebSyncedId()
        } else if (maxCallId > 0L) {
            store.setLastWebSyncedId(maxCallId)
        }
        call.resolve(JSObject().put("lastWebSyncedId", store.getLastWebSyncedId()))
    }

    @PluginMethod
    fun updateMissedCallSettings(call: PluginCall) {
        val store = CallLogSyncStore(context)
        val enabled = call.getBoolean("enabled") ?: store.isReminderEnabled()
        val delayMinutes = call.getInt("delayMinutes") ?: store.getDelayMinutes()
        val quietHoursEnabled = call.getBoolean("quietHoursEnabled") ?: store.isQuietHoursEnabled()
        val quietStartHour = call.getInt("quietStartHour") ?: store.getQuietStartHour()
        val quietEndHour = call.getInt("quietEndHour") ?: store.getQuietEndHour()

        store.updateSettings(
            reminderEnabled = enabled,
            delayMinutes = delayMinutes,
            quietHoursEnabled = quietHoursEnabled,
            quietStartHour = quietStartHour,
            quietEndHour = quietEndHour
        )
        call.resolve(JSObject().put("saved", true))
    }

    @PluginMethod
    fun markMissedCallReturned(call: PluginCall) {
        val number = call.getString("number")?.trim().orEmpty()
        if (number.isNotEmpty()) {
            CallLogSyncEngine.markMissedCallReturnedByNumber(context, number)
        }
        call.resolve(JSObject().put("marked", number.isNotEmpty()))
    }

    @PluginMethod
    fun startListening(call: PluginCall) {
        registerObserver()
        CallLogSyncWorker.ensurePeriodicWork(context)
        call.resolve()
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        unregisterObserver()
        call.resolve()
    }

    private fun registerObserver() {
        if (callLogObserver != null || !CallLogReader.hasReadCallLogPermission(context)) return
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                super.onChange(selfChange)
                notifyListeners("callLogChanged", JSObject())
            }
        }
        try {
            context.contentResolver.registerContentObserver(
                CallLog.Calls.CONTENT_URI,
                true,
                observer
            )
            callLogObserver = observer
        } catch (_: Exception) {
            // Ignore registration failures when permission is revoked
        }
    }

    private fun unregisterObserver() {
        val obs = callLogObserver ?: return
        try {
            context.contentResolver.unregisterContentObserver(obs)
        } catch (_: Exception) {
            // Ignore
        } finally {
            callLogObserver = null
        }
    }

    private fun buildPermissionStatusJson(): JSObject {
        val callLogGranted = CallLogReader.hasReadCallLogPermission(context)
        val phoneStateGranted = CallLogReader.hasReadPhoneStatePermission(context)
        val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationHelper.canPostNotifications(context)
        }
        val exactAlarmGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            am?.canScheduleExactAlarms() == true
        } else {
            true
        }
        val batteryIgnored = OemSettingsHelper.isIgnoringBatteryOptimizations(context)

        return JSObject().apply {
            put("callLog", if (callLogGranted) "granted" else permissionStateString("callLog"))
            put("phoneState", if (phoneStateGranted) "granted" else permissionStateString("phoneState"))
            put("notifications", if (notificationsGranted) "granted" else permissionStateString("notifications"))
            put("exactAlarm", if (exactAlarmGranted) "granted" else "denied")
            put("batteryOptimizationIgnored", batteryIgnored)
            put("allCoreGranted", callLogGranted && phoneStateGranted && notificationsGranted)
        }
    }

    private fun permissionStateString(alias: String): String {
        return when (getPermissionState(alias)) {
            PermissionState.GRANTED -> "granted"
            PermissionState.DENIED -> "denied"
            else -> "prompt"
        }
    }

    companion object {
        private const val DEFAULT_SYNC_PAGE_SIZE = 2000

        @Volatile
        private var activeInstance: WeakReference<CallLogSyncPlugin>? = null

        fun notifyCallLogChanged() {
            activeInstance?.get()?.let { plugin ->
                plugin.notifyListeners("callLogChanged", JSObject())
            }
        }
    }
}
