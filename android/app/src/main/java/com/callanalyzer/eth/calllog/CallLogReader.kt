package com.callanalyzer.eth.calllog

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.os.Build
import android.provider.CallLog
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import org.json.JSONObject

data class NativeCallEntry(
    val rawId: Long,
    val number: String,
    val normalizedNumber: String,
    val name: String?,
    val direction: String, // incoming | outgoing | missed | rejected
    val sim: String?, // SIM 1 | SIM 2 | null
    val timestamp: Long,
    val duration: Long
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", "android_$rawId")
        put("rawId", rawId)
        put("number", number)
        put("normalizedNumber", normalizedNumber)
        put("name", name ?: JSONObject.NULL)
        put("direction", direction)
        put("sim", sim ?: JSONObject.NULL)
        put("timestamp", timestamp)
        put("duration", duration)
    }
}

object CallLogReader {
    fun hasReadCallLogPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasReadPhoneStatePermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun getMaxCallId(context: Context): Long {
        if (!hasReadCallLogPermission(context)) return 0L
        return try {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                null,
                null,
                "${CallLog.Calls._ID} DESC LIMIT 1"
            )?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getLong(0) else 0L
            } ?: 0L
        } catch (_: Exception) {
            0L
        }
    }

    fun queryCallsAfterId(
        context: Context,
        afterId: Long,
        limit: Int? = null,
        beforeId: Long? = null
    ): List<NativeCallEntry> {
        if (!hasReadCallLogPermission(context)) return emptyList()

        val simLookup = buildSimLookup(context)
        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.PHONE_ACCOUNT_ID
        )

        val selectionParts = mutableListOf<String>()
        val selectionArgList = mutableListOf<String>()
        if (afterId > 0L) {
            selectionParts.add("${CallLog.Calls._ID} > ?")
            selectionArgList.add(afterId.toString())
        }
        if (beforeId != null && beforeId > 0L) {
            selectionParts.add("${CallLog.Calls._ID} < ?")
            selectionArgList.add(beforeId.toString())
        }
        val selection = if (selectionParts.isNotEmpty()) selectionParts.joinToString(" AND ") else null
        val selectionArgs = if (selectionArgList.isNotEmpty()) selectionArgList.toTypedArray() else null
        val sortOrder = if (limit != null && limit > 0) {
            "${CallLog.Calls._ID} DESC LIMIT $limit"
        } else {
            "${CallLog.Calls._ID} DESC"
        }

        val results = mutableListOf<NativeCallEntry>()
        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )
            if (cursor == null) return emptyList()

            val idIdx = cursor.getColumnIndex(CallLog.Calls._ID)
            val numIdx = cursor.getColumnIndex(CallLog.Calls.NUMBER)
            val nameIdx = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
            val typeIdx = cursor.getColumnIndex(CallLog.Calls.TYPE)
            val dateIdx = cursor.getColumnIndex(CallLog.Calls.DATE)
            val durIdx = cursor.getColumnIndex(CallLog.Calls.DURATION)
            val acctIdx = cursor.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)

            while (cursor.moveToNext()) {
                val rawId = if (idIdx >= 0) cursor.getLong(idIdx) else continue
                val number = (if (numIdx >= 0) cursor.getString(numIdx) else null)?.trim()
                if (number.isNullOrEmpty()) continue

                val cachedName = (if (nameIdx >= 0) cursor.getString(nameIdx) else null)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

                val callType = if (typeIdx >= 0) cursor.getInt(typeIdx) else CallLog.Calls.INCOMING_TYPE
                val direction = mapCallType(callType)
                val timestamp = if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L
                val duration = (if (durIdx >= 0) cursor.getLong(durIdx) else 0L).coerceAtLeast(0L)
                val phoneAccountId = if (acctIdx >= 0) cursor.getString(acctIdx) else null
                val sim = resolveSimSlot(phoneAccountId, simLookup)

                results.add(
                    NativeCallEntry(
                        rawId = rawId,
                        number = number,
                        normalizedNumber = PhoneNormalizer.normalize(number),
                        name = cachedName,
                        direction = direction,
                        sim = sim,
                        timestamp = timestamp,
                        duration = duration
                    )
                )
            }
        } catch (_: SecurityException) {
            return emptyList()
        } catch (_: Exception) {
            return emptyList()
        } finally {
            cursor?.close()
        }

        // Return chronological ascending order (oldest -> newest) so callers can evaluate missed -> outgoing cleanly
        return results.sortedBy { it.rawId }
    }

    private fun mapCallType(type: Int): String {
        return when (type) {
            CallLog.Calls.INCOMING_TYPE -> "incoming"
            CallLog.Calls.OUTGOING_TYPE -> "outgoing"
            CallLog.Calls.MISSED_TYPE -> "missed"
            CallLog.Calls.REJECTED_TYPE -> "rejected"
            else -> "incoming"
        }
    }

    private data class SimLookup(
        val idToSlot: Map<String, String>,
        val orderedIds: List<String>
    )

    private fun buildSimLookup(context: Context): SimLookup {
        val map = mutableMapOf<String, String>()
        val orderedIds = mutableListOf<String>()
        if (!hasReadPhoneStatePermission(context)) {
            return SimLookup(map, orderedIds)
        }

        try {
            val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            val subs: List<SubscriptionInfo> = try {
                subManager?.activeSubscriptionInfoList ?: emptyList()
            } catch (_: SecurityException) {
                emptyList()
            }

            for (info in subs.sortedBy { it.simSlotIndex }) {
                val slotLabel = when (info.simSlotIndex) {
                    0 -> "SIM 1"
                    1 -> "SIM 2"
                    else -> null
                } ?: continue

                val subIdStr = info.subscriptionId.toString()
                map[subIdStr] = slotLabel
                orderedIds.add(subIdStr)

                val iccId = info.iccId?.trim()
                if (!iccId.isNullOrEmpty()) {
                    map[iccId] = slotLabel
                    map[iccId.lowercase()] = slotLabel
                    map[iccId.uppercase()] = slotLabel
                }
            }

            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            val accounts: List<PhoneAccountHandle> = try {
                telecom?.callCapablePhoneAccounts ?: emptyList()
            } catch (_: SecurityException) {
                emptyList()
            }

            accounts.forEachIndexed { index, handle ->
                val handleId = handle.id?.trim() ?: return@forEachIndexed
                var resolvedSlot: String? = map[handleId] ?: map[handleId.lowercase()]

                if (resolvedSlot == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && subManager != null) {
                    try {
                        val subId = subManager.getSubscriptionId(handle)
                        if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                            resolvedSlot = map[subId.toString()]
                        }
                    } catch (_: Exception) {
                        // Ignore OEM reflection/API differences
                    }
                }

                if (resolvedSlot == null && index in 0..1 && accounts.size <= 2) {
                    resolvedSlot = if (index == 0) "SIM 1" else "SIM 2"
                }

                if (resolvedSlot != null) {
                    map[handleId] = resolvedSlot
                    map[handleId.lowercase()] = resolvedSlot
                }
            }
        } catch (_: Exception) {
            // Fall back to empty lookup
        }

        return SimLookup(map, orderedIds)
    }

    private fun resolveSimSlot(phoneAccountId: String?, lookup: SimLookup): String? {
        if (phoneAccountId.isNullOrBlank()) return null
        val trimmed = phoneAccountId.trim()

        lookup.idToSlot[trimmed]?.let { return it }
        lookup.idToSlot[trimmed.lowercase()]?.let { return it }

        // Check substring/ICCID prefix/suffix match (some OEMs strip trailing check digit or add prefixes like "E:"/"sub:")
        val digitsOnly = trimmed.replace(Regex("[^0-9]"), "")
        if (digitsOnly.isNotEmpty()) {
            lookup.idToSlot[digitsOnly]?.let { return it }
            for ((key, slot) in lookup.idToSlot) {
                if (key.length >= 6 && (trimmed.contains(key, ignoreCase = true) || key.contains(trimmed, ignoreCase = true))) {
                    return slot
                }
            }
        }

        // Fallback for 0/1 slot-based PHONE_ACCOUNT_ID
        return when (trimmed) {
            "0", "sim1", "SIM1", "SIM 1" -> "SIM 1"
            "1", "sim2", "SIM2", "SIM 2" -> "SIM 2"
            else -> null
        }
    }
}
