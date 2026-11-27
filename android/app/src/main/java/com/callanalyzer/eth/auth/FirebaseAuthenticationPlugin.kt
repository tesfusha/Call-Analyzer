package com.callanalyzer.eth.auth

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes
import com.google.android.gms.common.api.ApiException

/**
 * First-party Capacitor Google Sign-In bridge exposed as `FirebaseAuthentication`
 * so native Android builds always provide `signInWithGoogle` & `signOut` without
 * relying on external npm peer-dependency resolution.
 */
@CapacitorPlugin(name = "FirebaseAuthentication")
class FirebaseAuthenticationPlugin : Plugin() {

    private fun resolveStringResource(name: String): String? {
        val resId = context.resources.getIdentifier(name, "string", context.packageName)
        if (resId == 0) return null
        return try {
            context.getString(resId).trim().takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        }
    }

    private fun resolveWebClientId(call: PluginCall?): String? {
        val fromGoogleServices = resolveStringResource("default_web_client_id")
        if (fromGoogleServices != null) return fromGoogleServices

        val explicit = call?.getString("serverClientId")?.trim()?.takeIf { it.isNotEmpty() }
        if (explicit != null) return explicit

        return resolveStringResource("firebase_web_client_id")
    }

    private fun buildClient(webClientId: String?): GoogleSignInClient? {
        val currentActivity = activity ?: return null
        val builder = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
        if (!webClientId.isNullOrBlank()) {
            builder.requestIdToken(webClientId)
        }
        return GoogleSignIn.getClient(currentActivity, builder.build())
    }

    @PluginMethod
    fun signInWithGoogle(call: PluginCall) {
        val currentActivity = activity
        if (currentActivity == null) {
            call.reject("Android activity unavailable for Google Sign-In.")
            return
        }

        val webClientId = resolveWebClientId(call)
        if (webClientId.isNullOrBlank()) {
            call.reject("Missing Google Web OAuth Client ID (default_web_client_id).")
            return
        }

        val client = buildClient(webClientId)
        if (client == null) {
            call.reject("Could not initialize Google Sign-In client.")
            return
        }

        val launchPicker = {
            try {
                val signInIntent: Intent = client.signInIntent
                startActivityForResult(call, signInIntent, "handleGoogleSignInResult")
            } catch (e: Exception) {
                call.reject("Could not open Google Sign-In: ${e.message ?: "Unknown error"}")
            }
        }

        // Sign out any cached Google session first so the account chooser is always shown
        client.signOut().addOnCompleteListener(currentActivity) {
            launchPicker()
        }
    }

    @ActivityCallback
    private fun handleGoogleSignInResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return

        val data = result.data
        if (data == null && result.resultCode == Activity.RESULT_CANCELED) {
            call.reject("12501: Google Sign-In cancelled")
            return
        }

        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken

            if (account == null || idToken.isNullOrBlank()) {
                call.reject(
                    "Google Sign-In returned no ID token. Confirm google-services.json and your Android SHA-1 are configured in Firebase Console."
                )
                return
            }

            val credentialObj = JSObject().apply {
                put("idToken", idToken)
                put("accessToken", JSObject.NULL)
            }

            val userObj = JSObject().apply {
                put("email", account.email ?: JSObject.NULL)
                put("displayName", account.displayName ?: JSObject.NULL)
                put("photoUrl", account.photoUrl?.toString() ?: JSObject.NULL)
            }

            val response = JSObject().apply {
                put("credential", credentialObj)
                put("user", userObj)
            }
            call.resolve(response)
        } catch (e: ApiException) {
            if (e.statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
                call.reject("12501: Google Sign-In cancelled")
                return
            }
            call.reject("Google Sign-In failed (${e.statusCode}): ${e.message ?: "Unknown error"}")
        } catch (e: Exception) {
            call.reject("Google Sign-In failed: ${e.message ?: "Unknown error"}")
        }
    }

    @PluginMethod
    fun signInSilentGoogle(call: PluginCall) {
        val currentActivity = activity
        if (currentActivity == null) {
            call.reject("Android activity unavailable for Google Sign-In.")
            return
        }
        val webClientId = resolveWebClientId(call)
        if (webClientId.isNullOrBlank()) {
            call.reject("Missing Google Web OAuth Client ID (default_web_client_id).")
            return
        }
        val client = buildClient(webClientId)
        if (client == null) {
            call.reject("Could not initialize Google Sign-In client.")
            return
        }
        client.silentSignIn().addOnCompleteListener(currentActivity) { task ->
            try {
                val account = task.getResult(ApiException::class.java)
                val idToken = account?.idToken
                if (account != null && !idToken.isNullOrBlank()) {
                    val credentialObj = JSObject().apply {
                        put("idToken", idToken)
                        put("accessToken", JSObject.NULL)
                    }
                    val userObj = JSObject().apply {
                        put("email", account.email ?: JSObject.NULL)
                        put("displayName", account.displayName ?: JSObject.NULL)
                        put("photoUrl", account.photoUrl?.toString() ?: JSObject.NULL)
                    }
                    val response = JSObject().apply {
                        put("credential", credentialObj)
                        put("user", userObj)
                    }
                    call.resolve(response)
                    return@addOnCompleteListener
                }
            } catch (_: Exception) {
                // Fall back to interactive account picker if silent token expired
            }
            try {
                startActivityForResult(call, client.signInIntent, "handleGoogleSignInResult")
            } catch (e: Exception) {
                call.reject("Could not open Google Sign-In: ${e.message ?: "Unknown error"}")
            }
        }
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        val currentActivity = activity
        val client = buildClient(resolveWebClientId(call))
        if (currentActivity == null || client == null) {
            call.resolve()
            return
        }
        client.signOut().addOnCompleteListener(currentActivity) {
            call.resolve()
        }
    }
}
