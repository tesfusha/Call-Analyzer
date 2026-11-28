package com.callanalyzer.eth

import android.content.Intent
import android.os.Bundle
import com.callanalyzer.eth.auth.BiometricAuthPlugin
import com.callanalyzer.eth.auth.FirebaseAuthenticationPlugin
import com.callanalyzer.eth.calllog.CallLogSyncPlugin
import com.callanalyzer.eth.calllog.CallLogSyncWorker
import com.callanalyzer.eth.calllog.NotificationHelper
import com.callanalyzer.eth.contacts.PhoneContactsPlugin
import com.callanalyzer.eth.export.FileExportPlugin
import com.callanalyzer.eth.notifications.AppNotificationsPlugin
import com.getcapacitor.BridgeActivity
import org.json.JSONObject

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(FirebaseAuthenticationPlugin::class.java)
        registerPlugin(BiometricAuthPlugin::class.java)
        registerPlugin(CallLogSyncPlugin::class.java)
        registerPlugin(PhoneContactsPlugin::class.java)
        registerPlugin(FileExportPlugin::class.java)
        registerPlugin(AppNotificationsPlugin::class.java)
        super.onCreate(savedInstanceState)
        bridge?.webView?.settings?.apply {
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }
        NotificationHelper.ensureChannels(this)
        CallLogSyncWorker.ensurePeriodicWork(this)
        handleShortcutIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShortcutIntent(intent)
    }

    private fun handleShortcutIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "callanalyzer" || data.host != "shortcut") return
        val target = data.lastPathSegment?.trim().orEmpty()
        val actionId = when (target) {
            "reminders" -> "shortcut_reminders"
            "analytics" -> "shortcut_analytics"
            "usage" -> "shortcut_usage"
            "calendar" -> "shortcut_calendar"
            else -> return
        }
        intent.data = null
        val payload = JSONObject().put("actionId", actionId)
        AppNotificationsPlugin.dispatchAction(this, payload)
    }
}
