# Call Analyzer - ETH release R8 / ProGuard keep rules
# Preserve Capacitor bridge, custom Android plugins, BiometricPrompt, and Google Auth classes.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions

# Capacitor core & plugins
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}

# Custom Call Analyzer - ETH native plugins, receivers, and workers
-keep class com.callanalyzer.eth.** { *; }

# AndroidX Biometric & Security Crypto
-keep class androidx.biometric.** { *; }
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }

# Google Sign-In & Play Services Auth
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
