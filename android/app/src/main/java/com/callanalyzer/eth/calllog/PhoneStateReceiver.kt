package com.callanalyzer.eth.calllog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class PhoneStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        if (state != TelephonyManager.EXTRA_STATE_IDLE) return

        val appContext = context.applicationContext
        // Enqueue a WorkManager one-shot backup in case OEM kills the process before the delay elapses
        CallLogSyncWorker.enqueueOneShot(appContext)

        val pendingResult = goAsync()
        executor.schedule({
            try {
                // Wait briefly for Android's ContactsProvider / CallLog.Calls insert to commit after IDLE
                CallLogSyncEngine.evaluateNewCalls(appContext)
                CallLogSyncPlugin.notifyCallLogChanged()
            } catch (_: Exception) {
                // Handled by WorkManager backup
            } finally {
                pendingResult.finish()
            }
        }, 1500L, TimeUnit.MILLISECONDS)
    }

    companion object {
        private val executor = Executors.newSingleThreadScheduledExecutor()
    }
}
