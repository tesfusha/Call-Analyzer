package com.callanalyzer.eth.calllog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.UserManager
import java.util.concurrent.Executors

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }

        val appContext = context.applicationContext
        val userManager = appContext.getSystemService(Context.USER_SERVICE) as? UserManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && userManager?.isUserUnlocked == false) {
            // Wait for regular BOOT_COMPLETED once credential-encrypted storage is unlocked
            return
        }

        NotificationHelper.ensureChannels(appContext)
        CallLogSyncWorker.ensurePeriodicWork(appContext)

        val pendingResult = goAsync()
        executor.execute {
            try {
                CallLogSyncEngine.reschedulePendingAlarms(appContext)
                CallLogSyncEngine.evaluateNewCalls(appContext)
            } catch (_: Exception) {
                // Ignore boot-time transient errors; periodic worker remains active
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
