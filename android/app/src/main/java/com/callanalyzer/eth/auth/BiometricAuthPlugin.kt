package com.callanalyzer.eth.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Native Android BiometricPrompt + AndroidKeyStore AES-GCM bridge:
 * - Supports fingerprint/biometric app unlock alongside PIN lock
 * - Supports encrypted credential sealing for one-tap "Sign in with Fingerprint"
 */
@CapacitorPlugin(name = "BiometricAuth")
class BiometricAuthPlugin : Plugin() {

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "call_analyzer_biometric_aes_key_v1"
        private const val PREFS_NAME = "call_analyzer_biometric_prefs_v1"
        private const val KEY_ENCRYPTED_LOGIN = "encrypted_login_payload"
        private const val KEY_UNLOCK_PREFIX = "biometric_unlock_uid_"
        private const val GCM_TAG_BITS = 128
        private const val ALLOWED_AUTHENTICATORS =
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.BIOMETRIC_WEAK
    }

    private fun prefs() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun checkBiometricAvailability(): Pair<Boolean, String> {
        val manager = BiometricManager.from(context)
        return when (manager.canAuthenticate(ALLOWED_AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true to "available"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> false to "no_hardware"
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> false to "hw_unavailable"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> false to "none_enrolled"
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> false to "security_update_required"
            else -> false to "unavailable"
        }
    }

    private fun getOrCreateAesKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    private fun encryptPayload(json: JSONObject): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateAesKey())
        val iv = cipher.iv
        val encrypted = cipher.doFinal(json.toString().toByteArray(StandardCharsets.UTF_8))
        val envelope = JSONObject().apply {
            put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            put("ct", Base64.encodeToString(encrypted, Base64.NO_WRAP))
        }
        return envelope.toString()
    }

    private fun decryptPayload(rawEnvelope: String): JSONObject? {
        return try {
            val envelope = JSONObject(rawEnvelope)
            val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
            val ct = Base64.decode(envelope.getString("ct"), Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateAesKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
            val plainBytes = cipher.doFinal(ct)
            JSONObject(String(plainBytes, StandardCharsets.UTF_8))
        } catch (_: Exception) {
            null
        }
    }

    private fun readSavedMeta(): JSONObject? {
        val raw = prefs().getString(KEY_ENCRYPTED_LOGIN, null) ?: return null
        return decryptPayload(raw)
    }

    private fun showBiometricPrompt(
        title: String,
        subtitle: String,
        negativeText: String,
        onSuccess: () -> Unit,
        onCancelOrError: (isCancelled: Boolean, message: String) -> Unit
    ) {
        val currentActivity = activity as? FragmentActivity
        if (currentActivity == null) {
            onCancelOrError(false, "Biometric prompt requires an active screen.")
            return
        }

        val (available, reason) = checkBiometricAvailability()
        if (!available) {
            val msg = when (reason) {
                "none_enrolled" -> "No fingerprint or biometric is enrolled in Android Settings."
                "no_hardware" -> "This device does not support biometric authentication."
                else -> "Biometric authentication is currently unavailable."
            }
            onCancelOrError(false, msg)
            return
        }

        currentActivity.runOnUiThread {
            try {
                val executor = ContextCompat.getMainExecutor(currentActivity)
                val prompt = BiometricPrompt(
                    currentActivity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            onSuccess()
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                                errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                                errorCode == BiometricPrompt.ERROR_CANCELED
                            onCancelOrError(cancelled, errString.toString())
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            // Allow user to retry on sensor without immediately rejecting
                        }
                    }
                )

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButtonText(negativeText)
                    .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
                    .setConfirmationRequired(false)
                    .build()

                prompt.authenticate(promptInfo)
            } catch (e: Exception) {
                onCancelOrError(false, e.message ?: "Could not open biometric prompt.")
            }
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val uid = call.getString("uid")?.trim().orEmpty()
        val (available, reason) = checkBiometricAvailability()
        val saved = readSavedMeta()
        val unlockEnabled = if (uid.isNotEmpty()) {
            prefs().getBoolean("$KEY_UNLOCK_PREFIX$uid", false)
        } else {
            false
        }

        val res = JSObject().apply {
            put("available", available)
            put("reason", reason)
            put("unlockEnabled", available && unlockEnabled)
            put("hasSavedLogin", available && saved != null)
            put("savedUid", saved?.optString("uid")?.takeIf { it.isNotEmpty() } ?: JSObject.NULL)
            put("savedEmail", saved?.optString("email")?.takeIf { it.isNotEmpty() } ?: JSObject.NULL)
            put("savedProvider", saved?.optString("provider")?.takeIf { it.isNotEmpty() } ?: JSObject.NULL)
            put("savedDisplayName", saved?.optString("displayName")?.takeIf { it.isNotEmpty() } ?: JSObject.NULL)
        }
        call.resolve(res)
    }

    @PluginMethod
    fun authenticate(call: PluginCall) {
        val title = call.getString("title")?.trim().takeUnless { it.isNullOrEmpty() }
            ?: "Unlock Call Analyzer - ETH"
        val subtitle = call.getString("subtitle")?.trim().takeUnless { it.isNullOrEmpty() }
            ?: "Verify your fingerprint to continue"
        val negativeText = call.getString("negativeButtonText")?.trim().takeUnless { it.isNullOrEmpty() }
            ?: "Cancel"

        showBiometricPrompt(
            title = title,
            subtitle = subtitle,
            negativeText = negativeText,
            onSuccess = {
                call.resolve(JSObject().apply { put("authenticated", true) })
            },
            onCancelOrError = { cancelled, message ->
                if (cancelled) {
                    call.resolve(JSObject().apply {
                        put("authenticated", false)
                        put("cancelled", true)
                        put("error", message)
                    })
                } else {
                    call.reject(message)
                }
            }
        )
    }

    @PluginMethod
    fun setBiometricUnlockEnabled(call: PluginCall) {
        val uid = call.getString("uid")?.trim().orEmpty()
        val enabled = call.getBoolean("enabled") ?: false
        if (uid.isEmpty()) {
            call.reject("User ID is required.")
            return
        }

        if (!enabled) {
            prefs().edit().putBoolean("$KEY_UNLOCK_PREFIX$uid", false).apply()
            call.resolve(JSObject().apply { put("enabled", false) })
            return
        }

        showBiometricPrompt(
            title = "Enable Fingerprint Unlock",
            subtitle = "Confirm your fingerprint to unlock the lock screen",
            negativeText = "Cancel",
            onSuccess = {
                prefs().edit().putBoolean("$KEY_UNLOCK_PREFIX$uid", true).apply()
                call.resolve(JSObject().apply { put("enabled", true) })
            },
            onCancelOrError = { cancelled, message ->
                if (cancelled) {
                    call.resolve(JSObject().apply {
                        put("enabled", false)
                        put("cancelled", true)
                    })
                } else {
                    call.reject(message)
                }
            }
        )
    }

    @PluginMethod
    fun saveLoginCredential(call: PluginCall) {
        val uid = call.getString("uid")?.trim().orEmpty()
        val email = call.getString("email")?.trim().orEmpty()
        val provider = call.getString("provider")?.trim().orEmpty().ifEmpty { "password" }
        val password = call.getString("password").orEmpty()
        val displayName = call.getString("displayName")?.trim().orEmpty()

        if (uid.isEmpty() || email.isEmpty()) {
            call.reject("Account UID and email are required.")
            return
        }
        if (provider == "password" && password.isEmpty()) {
            call.reject("Enter your current password to enable fingerprint sign-in.")
            return
        }

        showBiometricPrompt(
            title = "Enable Fingerprint Sign-In",
            subtitle = "Confirm your fingerprint for $email",
            negativeText = "Cancel",
            onSuccess = {
                try {
                    val payload = JSONObject().apply {
                        put("uid", uid)
                        put("email", email)
                        put("provider", provider)
                        put("displayName", displayName)
                        if (provider == "password") {
                            put("password", password)
                        }
                    }
                    val encrypted = encryptPayload(payload)
                    prefs().edit().putString(KEY_ENCRYPTED_LOGIN, encrypted).apply()
                    call.resolve(JSObject().apply {
                        put("saved", true)
                        put("email", email)
                        put("provider", provider)
                    })
                } catch (e: Exception) {
                    call.reject("Could not seal biometric credential: ${e.message ?: "Unknown error"}")
                }
            },
            onCancelOrError = { cancelled, message ->
                if (cancelled) {
                    call.resolve(JSObject().apply {
                        put("saved", false)
                        put("cancelled", true)
                    })
                } else {
                    call.reject(message)
                }
            }
        )
    }

    @PluginMethod
    fun signInWithBiometric(call: PluginCall) {
        val raw = prefs().getString(KEY_ENCRYPTED_LOGIN, null)
        if (raw.isNullOrBlank()) {
            call.reject("No fingerprint login account is saved on this device.")
            return
        }

        showBiometricPrompt(
            title = "Sign in with Fingerprint",
            subtitle = "Verify your fingerprint to access your account",
            negativeText = "Use password",
            onSuccess = {
                val payload = decryptPayload(raw)
                if (payload == null) {
                    prefs().edit().remove(KEY_ENCRYPTED_LOGIN).apply()
                    call.reject("Saved fingerprint login expired or device biometrics changed. Please sign in once and re-enable it.")
                    return@showBiometricPrompt
                }
                val res = JSObject().apply {
                    put("authenticated", true)
                    put("uid", payload.optString("uid"))
                    put("email", payload.optString("email"))
                    put("provider", payload.optString("provider", "password"))
                    put("displayName", payload.optString("displayName"))
                    put("password", payload.optString("password"))
                }
                call.resolve(res)
            },
            onCancelOrError = { cancelled, message ->
                if (cancelled) {
                    call.resolve(JSObject().apply {
                        put("authenticated", false)
                        put("cancelled", true)
                    })
                } else {
                    call.reject(message)
                }
            }
        )
    }

    @PluginMethod
    fun clearSavedLoginCredential(call: PluginCall) {
        prefs().edit().remove(KEY_ENCRYPTED_LOGIN).apply()
        call.resolve(JSObject().apply { put("cleared", true) })
    }
}
