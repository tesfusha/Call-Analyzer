package com.callanalyzer.eth.export

import android.content.ContentValues
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@CapacitorPlugin(name = "FileExport")
class FileExportPlugin : Plugin() {
    private val ioExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val activeChunkFiles = java.util.concurrent.ConcurrentHashMap<String, File>()

    override fun handleOnDestroy() {
        activeChunkFiles.values.forEach { file ->
            try {
                if (file.exists()) file.delete()
            } catch (_: Exception) {
                // ignore
            }
        }
        activeChunkFiles.clear()
        ioExecutor.shutdown()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun beginChunkedSave(call: PluginCall) {
        val rawFilename = call.getString("filename")?.trim().orEmpty()
        if (rawFilename.isEmpty()) {
            call.reject("Missing filename.")
            return
        }
        val safeFilename = sanitizeFilename(rawFilename)
        val transferId = java.util.UUID.randomUUID().toString()
        val cacheDir = File(context.cacheDir, "chunk_exports")
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }
        val tempFile = File(cacheDir, "${transferId}_$safeFilename")
        try {
            if (tempFile.exists()) tempFile.delete()
            tempFile.createNewFile()
            activeChunkFiles[transferId] = tempFile
            val res = JSObject().apply {
                put("transferId", transferId)
            }
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Could not initialize chunked export: ${e.message ?: "Unknown error"}")
        }
    }

    @PluginMethod
    fun appendChunk(call: PluginCall) {
        val transferId = call.getString("transferId")?.trim().orEmpty()
        val base64Chunk = call.getString("base64Chunk")?.trim().orEmpty()
        val tempFile = activeChunkFiles[transferId]
        if (transferId.isEmpty() || tempFile == null) {
            call.reject("Invalid or expired export transfer.")
            return
        }
        if (base64Chunk.isEmpty()) {
            call.resolve(JSObject().apply { put("ok", true) })
            return
        }
        ioExecutor.execute {
            try {
                val bytes = Base64.decode(base64Chunk, Base64.DEFAULT)
                FileOutputStream(tempFile, true).use { out ->
                    out.write(bytes)
                    out.flush()
                }
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (e: Exception) {
                call.reject("Chunk write failed: ${e.message ?: "Unknown error"}")
            }
        }
    }

    @PluginMethod
    fun finishChunkedSave(call: PluginCall) {
        val transferId = call.getString("transferId")?.trim().orEmpty()
        val rawFilename = call.getString("filename")?.trim().orEmpty()
        val rawMimeType = call.getString("mimeType")?.trim().orEmpty()
        val shareTitle = call.getString("shareTitle")?.trim()?.takeIf { it.isNotEmpty() } ?: rawFilename
        val openShare = call.getBoolean("openShare") ?: true
        val tempFile = activeChunkFiles.remove(transferId)

        if (transferId.isEmpty() || tempFile == null || !tempFile.exists()) {
            call.reject("Missing chunked export file.")
            return
        }

        val safeFilename = sanitizeFilename(rawFilename.ifEmpty { tempFile.name })
        val mimeType = rawMimeType.ifEmpty { guessMimeType(safeFilename) }
        val appContext = context.applicationContext

        ioExecutor.execute {
            try {
                if (tempFile.length() <= 0L) {
                    call.reject("Exported file is empty.")
                    return@execute
                }
                val savedPath = saveFileToPublicStorage(appContext, safeFilename, mimeType, tempFile)
                var shared = false
                if (openShare) {
                    shared = launchShareChooserFromFile(safeFilename, mimeType, tempFile, shareTitle)
                }
                val res = JSObject().apply {
                    put("saved", savedPath != null)
                    put("shared", shared)
                    put("path", savedPath ?: safeFilename)
                }
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Export failed: ${e.message ?: "Unknown error"}")
            } finally {
                try {
                    if (tempFile.exists()) tempFile.delete()
                } catch (_: Exception) {
                    // ignore cleanup failure
                }
            }
        }
    }

    @PluginMethod
    fun saveAndShare(call: PluginCall) {
        val rawFilename = call.getString("filename")?.trim().orEmpty()
        val rawMimeType = call.getString("mimeType")?.trim().orEmpty()
        val base64Data = call.getString("base64Data")?.trim().orEmpty()
        val shareTitle = call.getString("shareTitle")?.trim()?.takeIf { it.isNotEmpty() } ?: rawFilename
        val openShare = call.getBoolean("openShare") ?: true

        if (rawFilename.isEmpty() || base64Data.isEmpty()) {
            call.reject("Missing filename or file data.")
            return
        }

        val safeFilename = sanitizeFilename(rawFilename)
        val mimeType = rawMimeType.ifEmpty { guessMimeType(safeFilename) }
        val appContext = context.applicationContext

        ioExecutor.execute {
            try {
                val cleanBase64 = base64Data.substringAfter("base64,", base64Data)
                val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                if (bytes.isEmpty()) {
                    call.reject("File data is empty.")
                    return@execute
                }

                val savedPath = saveBytesToPublicStorage(appContext, safeFilename, mimeType, bytes)
                var shared = false

                if (openShare) {
                    shared = launchShareChooser(safeFilename, mimeType, bytes, shareTitle)
                }

                val res = JSObject().apply {
                    put("saved", savedPath != null)
                    put("shared", shared)
                    put("path", savedPath ?: safeFilename)
                }
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Export failed: ${e.message ?: "Unknown error"}")
            }
        }
    }

    private fun saveFileToPublicStorage(
        appContext: android.content.Context,
        filename: String,
        mimeType: String,
        sourceFile: File
    ): String? {
        val isImage = mimeType.startsWith("image/", ignoreCase = true)
        val isVideo = mimeType.startsWith("video/", ignoreCase = true)
        val subfolder = "Call Analyzer - ETH"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = appContext.contentResolver
            val collection: Uri
            val relativeDir: String
            val values = ContentValues()

            if (isImage) {
                collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                relativeDir = "${Environment.DIRECTORY_PICTURES}/$subfolder"
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                values.put(MediaStore.Images.Media.MIME_TYPE, mimeType)
                values.put(MediaStore.Images.Media.RELATIVE_PATH, relativeDir)
                values.put(MediaStore.Images.Media.IS_PENDING, 1)
            } else if (isVideo) {
                collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                relativeDir = "${Environment.DIRECTORY_MOVIES}/$subfolder"
                values.put(MediaStore.Video.Media.DISPLAY_NAME, filename)
                values.put(MediaStore.Video.Media.MIME_TYPE, mimeType)
                values.put(MediaStore.Video.Media.RELATIVE_PATH, relativeDir)
                values.put(MediaStore.Video.Media.IS_PENDING, 1)
            } else {
                collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
                relativeDir = "${Environment.DIRECTORY_DOWNLOADS}/$subfolder"
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename)
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType)
                values.put(MediaStore.Downloads.RELATIVE_PATH, relativeDir)
                values.put(MediaStore.Downloads.IS_PENDING, 1)
            }

            var itemUri: Uri? = null
            try {
                itemUri = resolver.insert(collection, values)
                if (itemUri != null) {
                    resolver.openOutputStream(itemUri)?.use { out ->
                        sourceFile.inputStream().use { input ->
                            input.copyTo(out)
                        }
                        out.flush()
                    } ?: throw IllegalStateException("Could not open MediaStore output stream.")

                    val complete = ContentValues().apply {
                        if (isImage) {
                            put(MediaStore.Images.Media.IS_PENDING, 0)
                        } else if (isVideo) {
                            put(MediaStore.Video.Media.IS_PENDING, 0)
                        } else {
                            put(MediaStore.Downloads.IS_PENDING, 0)
                        }
                    }
                    resolver.update(itemUri, complete, null, null)
                    return "$relativeDir/$filename"
                }
            } catch (_: Exception) {
                if (itemUri != null) {
                    try {
                        resolver.delete(itemUri, null, null)
                    } catch (_: Exception) {
                        // Ignore cleanup failure
                    }
                }
            }
        }

        val envType = when {
            isImage -> Environment.DIRECTORY_PICTURES
            isVideo -> Environment.DIRECTORY_MOVIES
            else -> Environment.DIRECTORY_DOWNLOADS
        }
        @Suppress("DEPRECATION")
        val publicBase = Environment.getExternalStoragePublicDirectory(envType)
        val publicDir = File(publicBase, subfolder)
        val targetFile = try {
            if (!publicDir.exists()) publicDir.mkdirs()
            val candidate = uniqueFile(publicDir, filename)
            sourceFile.inputStream().use { input ->
                FileOutputStream(candidate).use { out ->
                    input.copyTo(out)
                }
            }
            candidate
        } catch (_: Exception) {
            val fallbackDir = File(appContext.getExternalFilesDir(envType) ?: appContext.filesDir, subfolder)
            if (!fallbackDir.exists()) fallbackDir.mkdirs()
            val candidate = uniqueFile(fallbackDir, filename)
            sourceFile.inputStream().use { input ->
                FileOutputStream(candidate).use { out ->
                    input.copyTo(out)
                }
            }
            candidate
        }

        if (isImage || isVideo) {
            MediaScannerConnection.scanFile(
                appContext,
                arrayOf(targetFile.absolutePath),
                arrayOf(mimeType),
                null
            )
        }

        val rootLabel = when {
            isImage -> "Pictures"
            isVideo -> "Movies"
            else -> "Downloads"
        }
        return "$rootLabel/$subfolder/${targetFile.name}"
    }

    private fun saveBytesToPublicStorage(
        appContext: android.content.Context,
        filename: String,
        mimeType: String,
        bytes: ByteArray
    ): String? {
        val isImage = mimeType.startsWith("image/", ignoreCase = true)
        val isVideo = mimeType.startsWith("video/", ignoreCase = true)
        val subfolder = "Call Analyzer - ETH"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = appContext.contentResolver
            val collection: Uri
            val relativeDir: String
            val values = ContentValues()

            if (isImage) {
                collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                relativeDir = "${Environment.DIRECTORY_PICTURES}/$subfolder"
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                values.put(MediaStore.Images.Media.MIME_TYPE, mimeType)
                values.put(MediaStore.Images.Media.RELATIVE_PATH, relativeDir)
                values.put(MediaStore.Images.Media.IS_PENDING, 1)
            } else if (isVideo) {
                collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                relativeDir = "${Environment.DIRECTORY_MOVIES}/$subfolder"
                values.put(MediaStore.Video.Media.DISPLAY_NAME, filename)
                values.put(MediaStore.Video.Media.MIME_TYPE, mimeType)
                values.put(MediaStore.Video.Media.RELATIVE_PATH, relativeDir)
                values.put(MediaStore.Video.Media.IS_PENDING, 1)
            } else {
                collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
                relativeDir = "${Environment.DIRECTORY_DOWNLOADS}/$subfolder"
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename)
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType)
                values.put(MediaStore.Downloads.RELATIVE_PATH, relativeDir)
                values.put(MediaStore.Downloads.IS_PENDING, 1)
            }

            var itemUri: Uri? = null
            try {
                itemUri = resolver.insert(collection, values)
                if (itemUri != null) {
                    resolver.openOutputStream(itemUri)?.use { out ->
                        out.write(bytes)
                        out.flush()
                    } ?: throw IllegalStateException("Could not open MediaStore output stream.")

                    val complete = ContentValues().apply {
                        if (isImage) {
                            put(MediaStore.Images.Media.IS_PENDING, 0)
                        } else if (isVideo) {
                            put(MediaStore.Video.Media.IS_PENDING, 0)
                        } else {
                            put(MediaStore.Downloads.IS_PENDING, 0)
                        }
                    }
                    resolver.update(itemUri, complete, null, null)
                    return "$relativeDir/$filename"
                }
            } catch (e: Exception) {
                if (itemUri != null) {
                    try {
                        resolver.delete(itemUri, null, null)
                    } catch (_: Exception) {
                        // Ignore cleanup failure
                    }
                }
                // Fall back to app external files directory below
            }
        }

        // Legacy API < 29 or MediaStore fallback
        val envType = when {
            isImage -> Environment.DIRECTORY_PICTURES
            isVideo -> Environment.DIRECTORY_MOVIES
            else -> Environment.DIRECTORY_DOWNLOADS
        }
        @Suppress("DEPRECATION")
        val publicBase = Environment.getExternalStoragePublicDirectory(envType)
        val publicDir = File(publicBase, subfolder)
        val targetFile = try {
            if (!publicDir.exists()) publicDir.mkdirs()
            val candidate = uniqueFile(publicDir, filename)
            FileOutputStream(candidate).use { it.write(bytes) }
            candidate
        } catch (_: Exception) {
            val fallbackDir = File(appContext.getExternalFilesDir(envType) ?: appContext.filesDir, subfolder)
            if (!fallbackDir.exists()) fallbackDir.mkdirs()
            val candidate = uniqueFile(fallbackDir, filename)
            FileOutputStream(candidate).use { it.write(bytes) }
            candidate
        }

        if (isImage || isVideo) {
            MediaScannerConnection.scanFile(
                appContext,
                arrayOf(targetFile.absolutePath),
                arrayOf(mimeType),
                null
            )
        }

        val rootLabel = when {
            isImage -> "Pictures"
            isVideo -> "Movies"
            else -> "Downloads"
        }
        return "$rootLabel/$subfolder/${targetFile.name}"
    }

    private fun launchShareChooserFromFile(
        filename: String,
        mimeType: String,
        sourceFile: File,
        shareTitle: String
    ): Boolean {
        val currentActivity = activity ?: return false
        val cacheExports = File(context.cacheDir, "exports")
        if (!cacheExports.exists()) {
            cacheExports.mkdirs()
        }
        val shareFile = File(cacheExports, filename)
        sourceFile.inputStream().use { input ->
            FileOutputStream(shareFile).use { out ->
                input.copyTo(out)
            }
        }

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            shareFile
        )

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, shareTitle)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(shareIntent, shareTitle).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        currentActivity.runOnUiThread {
            try {
                currentActivity.startActivity(chooser)
            } catch (_: Exception) {
                // Ignore if no activity can handle share
            }
        }
        return true
    }

    private fun launchShareChooser(
        filename: String,
        mimeType: String,
        bytes: ByteArray,
        shareTitle: String
    ): Boolean {
        val currentActivity = activity ?: return false
        val cacheExports = File(context.cacheDir, "exports")
        if (!cacheExports.exists()) {
            cacheExports.mkdirs()
        }
        val shareFile = File(cacheExports, filename)
        FileOutputStream(shareFile).use { it.write(bytes) }

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            shareFile
        )

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, shareTitle)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(shareIntent, shareTitle).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        currentActivity.runOnUiThread {
            try {
                currentActivity.startActivity(chooser)
            } catch (_: Exception) {
                // Ignore if no activity can handle share
            }
        }
        return true
    }

    private fun uniqueFile(dir: File, filename: String): File {
        val initial = File(dir, filename)
        if (!initial.exists()) return initial
        val dotIdx = filename.lastIndexOf('.')
        val stem = if (dotIdx > 0) filename.substring(0, dotIdx) else filename
        val ext = if (dotIdx > 0) filename.substring(dotIdx) else ""
        for (i in 1..99) {
            val next = File(dir, "$stem ($i)$ext")
            if (!next.exists()) return next
        }
        return File(dir, "${stem}_${System.currentTimeMillis()}$ext")
    }

    private fun sanitizeFilename(raw: String): String {
        val base = raw.substringAfterLast('/').substringAfterLast('\\')
        val clean = base.replace(Regex("[^a-zA-Z0-9._-]"), "_").trim('_')
        return clean.ifEmpty { "export-${System.currentTimeMillis()}.bin" }
    }

    private fun guessMimeType(filename: String): String {
        val lower = filename.lowercase()
        return when {
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            lower.endsWith(".mp4") -> "video/mp4"
            lower.endsWith(".webm") -> "video/webm"
            lower.endsWith(".pdf") -> "application/pdf"
            lower.endsWith(".csv") -> "text/csv"
            lower.endsWith(".json") -> "application/json"
            lower.endsWith(".html") -> "text/html"
            lower.endsWith(".vcf") -> "text/vcard"
            lower.endsWith(".ics") -> "text/calendar"
            else -> "application/octet-stream"
        }
    }
}
