package com.callanalyzer.eth.contacts

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.ContactsContract
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Native Android phone contacts bridge:
 * 1. pickContact(): Privacy-first single contact picker using ACTION_PICK (no READ_CONTACTS needed).
 * 2. getAllContacts(): On-demand bulk loader for saved phone contacts & birthdays (requests READ_CONTACTS only when tapped).
 */
@CapacitorPlugin(
    name = "PhoneContacts",
    permissions = [
        Permission(strings = [Manifest.permission.READ_CONTACTS], alias = "contacts")
    ]
)
class PhoneContactsPlugin : Plugin() {
    private val ioExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    override fun handleOnDestroy() {
        ioExecutor.shutdown()
        super.handleOnDestroy()
    }

    private fun hasReadContactsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
    }

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
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        )

        val contactsArray = JSArray()
        val seenKeys = HashSet<String>()
        var pickedContactId = ""
        var pickedName = ""
        var pickedNumber = ""
        try {
            context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val cidIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    pickedContactId = if (cidIdx >= 0) cursor.getString(cidIdx)?.trim().orEmpty() else ""
                    pickedNumber = if (numIdx >= 0) cursor.getString(numIdx)?.trim().orEmpty() else ""
                    pickedName = if (nameIdx >= 0) cursor.getString(nameIdx)?.trim().orEmpty() else ""
                }
            }

            // When READ_CONTACTS is already granted, include all numbers stored under the same contact (e.g. SIM 1 & SIM 2).
            if (pickedContactId.isNotEmpty() && (hasReadContactsPermission() || getPermissionState("contacts") == PermissionState.GRANTED)) {
                try {
                    val allProj = arrayOf(
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        ContactsContract.CommonDataKinds.Phone.NUMBER
                    )
                    context.contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        allProj,
                        "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                        arrayOf(pickedContactId),
                        null
                    )?.use { allCursor ->
                        val allNameIdx = allCursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                        val allNumIdx = allCursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                        while (allCursor.moveToNext()) {
                            val num = if (allNumIdx >= 0) allCursor.getString(allNumIdx)?.trim().orEmpty() else ""
                            if (num.isEmpty()) continue
                            val digits = num.filter { it.isDigit() }
                            val dedupeKey = if (digits.length >= 9) digits.takeLast(9) else (digits.ifEmpty { num })
                            if (!seenKeys.add(dedupeKey)) continue
                            val rowName = if (allNameIdx >= 0) allCursor.getString(allNameIdx)?.trim().orEmpty() else ""
                            val resolvedName = rowName.ifEmpty { pickedName }
                            contactsArray.put(JSObject().apply {
                                put("name", resolvedName.ifEmpty { num })
                                put("number", num)
                            })
                        }
                    }
                } catch (_: Exception) {
                    // Fall back to the single picked row below
                }
            }

            if (contactsArray.length() == 0 && pickedNumber.isNotEmpty()) {
                contactsArray.put(JSObject().apply {
                    put("name", pickedName.ifEmpty { pickedNumber })
                    put("number", pickedNumber)
                })
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

    @PluginMethod
    fun hasContactsPermission(call: PluginCall) {
        val granted = hasReadContactsPermission() || getPermissionState("contacts") == PermissionState.GRANTED
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun getAllContactsIfGranted(call: PluginCall) {
        if (hasReadContactsPermission() || getPermissionState("contacts") == PermissionState.GRANTED) {
            loadAllContactsAsync(call)
            return
        }
        val res = JSObject().apply {
            put("granted", false)
            put("contacts", JSArray())
            put("total", 0)
        }
        call.resolve(res)
    }

    @PluginMethod
    fun getAllContacts(call: PluginCall) {
        if (hasReadContactsPermission() || getPermissionState("contacts") == PermissionState.GRANTED) {
            loadAllContactsAsync(call)
            return
        }
        requestPermissionForAlias("contacts", call, "handleContactsPermissionResult")
    }

    @PermissionCallback
    private fun handleContactsPermissionResult(call: PluginCall) {
        if (hasReadContactsPermission() || getPermissionState("contacts") == PermissionState.GRANTED) {
            loadAllContactsAsync(call)
        } else {
            val res = JSObject().apply {
                put("granted", false)
                put("contacts", JSArray())
                put("total", 0)
            }
            call.resolve(res)
        }
    }

    private fun loadAllContactsAsync(call: PluginCall) {
        ioExecutor.execute {
            try {
                // 1. Optional birthdays keyed by CONTACT_ID
                val birthdaysByContactId = HashMap<String, String>()
                try {
                    val bdayProjection = arrayOf(
                        ContactsContract.CommonDataKinds.Event.CONTACT_ID,
                        ContactsContract.CommonDataKinds.Event.START_DATE
                    )
                    val bdaySelection =
                        "${ContactsContract.Data.MIMETYPE} = ? AND ${ContactsContract.CommonDataKinds.Event.TYPE} = ?"
                    val bdayArgs = arrayOf(
                        ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE,
                        ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY.toString()
                    )
                    context.contentResolver.query(
                        ContactsContract.Data.CONTENT_URI,
                        bdayProjection,
                        bdaySelection,
                        bdayArgs,
                        null
                    )?.use { cursor ->
                        val cidIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Event.CONTACT_ID)
                        val dateIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Event.START_DATE)
                        while (cursor.moveToNext()) {
                            val cid = if (cidIdx >= 0) cursor.getString(cidIdx)?.trim().orEmpty() else ""
                            val startDate = if (dateIdx >= 0) cursor.getString(dateIdx)?.trim().orEmpty() else ""
                            if (cid.isNotEmpty() && startDate.isNotEmpty() && !birthdaysByContactId.containsKey(cid)) {
                                birthdaysByContactId[cid] = startDate
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Birthdays are optional; continue even if OEM restricts Data.CONTENT_URI
                }

                // 2. Read all saved phone numbers with display names
                val phoneProjection = arrayOf(
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                )
                val seenKeys = HashSet<String>()
                val contactsArray = JSArray()

                context.contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    phoneProjection,
                    null,
                    null,
                    "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
                )?.use { cursor ->
                    val cidIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)

                    while (cursor.moveToNext()) {
                        val number = if (numIdx >= 0) cursor.getString(numIdx)?.trim().orEmpty() else ""
                        if (number.isEmpty()) continue
                        val digits = number.filter { it.isDigit() }
                        if (digits.length < 3) continue
                        val dedupeKey = if (digits.length >= 9) digits.takeLast(9) else digits
                        if (!seenKeys.add(dedupeKey)) continue

                        val cid = if (cidIdx >= 0) cursor.getString(cidIdx)?.trim().orEmpty() else ""
                        val name = if (nameIdx >= 0) cursor.getString(nameIdx)?.trim().orEmpty() else ""
                        val birthday = if (cid.isNotEmpty()) birthdaysByContactId[cid] else null

                        val item = JSObject().apply {
                            put("name", if (name.isNotEmpty()) name else number)
                            put("number", number)
                            if (!birthday.isNullOrEmpty()) {
                                put("birthday", birthday)
                            }
                        }
                        contactsArray.put(item)
                    }
                }

                val res = JSObject().apply {
                    put("granted", true)
                    put("contacts", contactsArray)
                    put("total", contactsArray.length())
                }
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Could not load phone contacts: ${e.message ?: "Unknown error"}")
            }
        }
    }
}
