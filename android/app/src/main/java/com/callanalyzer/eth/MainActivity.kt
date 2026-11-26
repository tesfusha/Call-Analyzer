package com.callanalyzer.eth

import android.os.Bundle
import com.callanalyzer.eth.calllog.CallLogSyncPlugin
import com.callanalyzer.eth.calllog.CallLogSyncWorker
import com.callanalyzer.eth.calllog.NotificationHelper
import com.callanalyzer.eth.contacts.PhoneContactsPlugin
import com.callanalyzer.eth.export.FileExportPlugin
import com.callanalyzer.eth.notifications.AppNotificationsPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(CallLogSyncPlugin::class.java)
        registerPlugin(PhoneContactsPlugin::class.java)
        registerPlugin(FileExportPlugin::class.java)
        registerPlugin(AppNotificationsPlugin::class.java)
        super.onCreate(savedInstanceState)
        NotificationHelper.ensureChannels(this)
        CallLogSyncWorker.ensurePeriodicWork(this)
    }
}
