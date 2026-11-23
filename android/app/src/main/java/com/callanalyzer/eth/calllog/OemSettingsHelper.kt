package com.callanalyzer.eth.calllog

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import org.json.JSONObject

object OemSettingsHelper {
    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun getDeviceBrandInfo(context: Context): JSONObject {
        val manufacturer = (Build.MANUFACTURER ?: "").trim()
        val brand = (Build.BRAND ?: "").trim()
        val combined = "$manufacturer $brand".lowercase()
        val oemFamily = when {
            combined.contains("tecno") -> "Tecno"
            combined.contains("infinix") -> "Infinix"
            combined.contains("itel") -> "itel"
            combined.contains("transsion") -> "Transsion (Tecno/Infinix/itel)"
            combined.contains("xiaomi") || combined.contains("redmi") || combined.contains("poco") -> "Xiaomi"
            combined.contains("samsung") -> "Samsung"
            else -> if (manufacturer.isNotEmpty()) manufacturer else "Android"
        }
        val isAggressiveOem = oemFamily in setOf(
            "Tecno",
            "Infinix",
            "itel",
            "Transsion (Tecno/Infinix/itel)",
            "Xiaomi",
            "Samsung"
        )

        return JSONObject().apply {
            put("manufacturer", manufacturer)
            put("brand", brand)
            put("model", (Build.MODEL ?: "").trim())
            put("oemFamily", oemFamily)
            put("isAggressiveOem", isAggressiveOem)
            put("batteryOptimizationIgnored", isIgnoringBatteryOptimizations(context))
        }
    }

    fun openBatteryOptimizationSettings(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !isIgnoringBatteryOptimizations(context)) {
            val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (tryStartActivity(context, direct)) return true
        }

        val listIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (tryStartActivity(context, listIntent)) return true

        return openAppDetailsSettings(context)
    }

    fun openAutostartSettings(context: Context): Boolean {
        val candidates = listOf(
            // Transsion (Tecno / Infinix / itel HiOS / XOS / itelOS)
            Intent().setComponent(ComponentName("com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity")),
            Intent().setComponent(ComponentName("com.transsion.phonemaster", "com.transsion.phonemaster.MainActivity")),
            Intent().setComponent(ComponentName("com.infinix.xmanager", "com.cyin.himgr.autostart.AutoStartActivity")),
            Intent().setComponent(ComponentName("com.itel.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity")),
            // Xiaomi / MIUI / HyperOS
            Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
            Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
                putExtra("extra_pkgname", context.packageName)
            },
            // Samsung Device Care / Sleeping apps
            Intent().setComponent(ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")),
            Intent().setComponent(ComponentName("com.samsung.android.sm", "com.samsung.android.sm.battery.ui.BatteryActivity")),
            // Other common OEMs
            Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
            Intent().setComponent(ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")),
            Intent().setComponent(ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"))
        )

        for (candidate in candidates) {
            candidate.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (tryStartActivity(context, candidate)) {
                return true
            }
        }

        // Fall back to App Info screen where Battery / Unrestricted background usage can be configured
        return openAppDetailsSettings(context)
    }

    fun openAppDetailsSettings(context: Context): Boolean {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return tryStartActivity(context, intent)
    }

    private fun tryStartActivity(context: Context, intent: Intent): Boolean {
        return try {
            val resolved = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
            if (resolved != null) {
                context.startActivity(intent)
                true
            } else {
                false
            }
        } catch (_: Exception) {
            false
        }
    }
}
