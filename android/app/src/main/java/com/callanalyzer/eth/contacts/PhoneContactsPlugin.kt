package com.callanalyzer.eth.contacts

import android.app.Activity
import android.content.Intent
import android.provider.ContactsContract
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Privacy-first native Android contact picker using ACTION_PICK on Phone.CONTENT_URI.
 * Android grants temporary read access ONLY to the specific contact URI chosen by the user,
 * so no broad READ_CONTACTS permission is required.
 */
@CapacitorPlugin(name = "PhoneContacts")
class PhoneContactsPlugin : Plugin() {

    @PluginMethod
    fun pickContact(call: PluginCall) {
        val primaryIntent = Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
        val intent = if (primaryIntent.resolveActivity(context.packageManager) != null) {
            primaryIntent
        } else {
            Intent(Intent.ACTION_PICK).apply {
                type = ContactsContract.CommonDataKinds.Phone.CONTENT_TYPE
            }
        }
        try {
            startActivityForResult(call, intent, "handlePickContactResult")
        } catch (e: Exception) {
            call.reject("No contacts app available on this device: ${e.message ?: "Unknown error"}")
        }
    }

    @ActivityCallback
    private fun handlePickContactResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return

        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            val res = JSObject().apply {
                put("cancelled", true)
                put("contacts", JSArray())
            }
            call.resolve(res)
            return
        }

        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        )

        val contactsArray = JSArray()
        try {
            context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val number = if (numIdx >= 0) cursor.getString(numIdx)?.trim().orEmpty() else ""
                    val name = if (nameIdx >= 0) cursor.getString(nameIdx)?.trim().orEmpty() else ""

                    if (number.isNotEmpty()) {
                        val item = JSObject().apply {
                            put("name", if (name.isNotEmpty()) name else number)
                            put("number", number)
                        }
                        contactsArray.put(item)
                    }
                }
            }
            val res = JSObject().apply {
                put("cancelled", false)
                put("contacts", contactsArray)
            }
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Could not read selected contact: ${e.message ?: "Unknown error"}")
        }
    }
}
