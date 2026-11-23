package com.callanalyzer.eth.calllog

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class CallLogSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        return try {
            NotificationHelper.ensureChannels(applicationContext)
            CallLogSyncEngine.evaluateNewCalls(applicationContext)
            CallLogSyncPlugin.notifyCallLogChanged()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val PERIODIC_WORK_NAME = "callanalyzer_periodic_call_log_sync"
        private const val ONESHOT_WORK_NAME = "callanalyzer_call_ended_sync"

        fun ensurePeriodicWork(context: Context) {
            val request = PeriodicWorkRequestBuilder<CallLogSyncWorker>(
                15L,
                TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun enqueueOneShot(context: Context) {
            val request = OneTimeWorkRequestBuilder<CallLogSyncWorker>()
                .setInitialDelay(2L, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                ONESHOT_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
