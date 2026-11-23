package com.callanalyzer.eth.notifications

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.callanalyzer.eth.MainActivity
import com.callanalyzer.eth.calllog.CallLogSyncEngine
import com.callanalyzer.eth.calllog.NotificationHelper

class AppNotificationActionActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val actionId = intent?.getStringExtra(AppNotificationDisplay.EXTRA_ACTION_ID) ?: "view"
        val id = intent?.getIntExtra(AppNotificationDisplay.EXTRA_NOTIFICATION_ID, -1) ?: -1
        val idKey = intent?.getStringExtra(AppNotificationDisplay.EXTRA_ID_KEY) ?: id.toString()
        val title = intent?.getStringExtra(AppNotificationDisplay.EXTRA_TITLE)
        val body = intent?.getStringExtra(AppNotificationDisplay.EXTRA_BODY)
        val category = intent?.getStringExtra(AppNotificationDisplay.EXTRA_CATEGORY) ?: "other"
        val number = intent?.getStringExtra(AppNotificationDisplay.EXTRA_NUMBER)?.trim()
        val contactKey = intent?.getStringExtra(AppNotificationDisplay.EXTRA_CONTACT_KEY)
        val eventId = intent?.getStringExtra(AppNotificationDisplay.EXTRA_EVENT_ID)
        val muteKey = intent?.getStringExtra(AppNotificationDisplay.EXTRA_MUTE_KEY)
        val wishText = intent?.getStringExtra(AppNotificationDisplay.EXTRA_WISH_TEXT)

        if (id >= 0) {
            NotificationHelper.cancelNotification(this, id)
        }

        var handledNatively = false

        when (actionId) {
            "call" -> {
                if (!number.isNullOrEmpty()) {
                    CallLogSyncEngine.markMissedCallReturnedByNumber(this, number)
                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null)).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    try {
                        startActivity(dialIntent)
                        handledNatively = true
                    } catch (_: Exception) {
                        openMainApp()
                    }
                } else {
                    openMainApp()
                }
            }

            "wish" -> {
                if (!number.isNullOrEmpty() && !wishText.isNullOrBlank()) {
                    val smsIntent = Intent(Intent.ACTION_SENDTO, Uri.fromParts("smsto", number, null)).apply {
                        putExtra("sms_body", wishText)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    try {
                        startActivity(smsIntent)
                        handledNatively = true
                    } catch (_: Exception) {
                        openMainApp()
                    }
                } else {
                    openMainApp()
                }
            }

            else -> {
                openMainApp()
            }
        }

        val eventJson = AppNotificationDisplay.buildActionEventJson(
            actionId = actionId,
            notificationId = id,
            idKey = idKey,
            title = title,
            body = body,
            category = category,
            number = number,
            contactKey = contactKey,
            eventId = eventId,
            muteKey = muteKey,
            wishText = wishText,
            timestamp = System.currentTimeMillis(),
            handledNatively = handledNatively
        )
        AppNotificationsPlugin.dispatchAction(applicationContext, eventJson)
        finish()
    }

    private fun openMainApp() {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        try {
            startActivity(launchIntent)
        } catch (_: Exception) {
            // Ignore launch failures
        }
    }
}
