package com.coachfoska.app.core.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream

@Composable
actual fun rememberUriBytesReader(maxBytes: Int?): (String) -> ByteArray? {
    require(maxBytes == null || maxBytes > 0) { "maxBytes must be positive" }
    val context = LocalContext.current
    return { uriString ->
        runCatching {
            val uri = Uri.parse(uriString)
            if (maxBytes != null) {
                val declaredLength = context.contentResolver.openAssetFileDescriptor(uri, "r")
                    ?.use { it.length }
                if (declaredLength != null && declaredLength >= 0 && declaredLength > maxBytes) {
                    return@runCatching null
                }
            }
            context.contentResolver.openInputStream(uri)?.use { input ->
                if (maxBytes == null) input.readBytes() else input.readBytesUpTo(maxBytes)
            }
        }.getOrNull()
    }
}

private fun InputStream.readBytesUpTo(maxBytes: Int): ByteArray? {
    val output = ByteArrayOutputStream(minOf(maxBytes, DEFAULT_BUFFER_SIZE))
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var total = 0
    while (true) {
        val count = read(buffer)
        if (count < 0) break
        if (count == 0) continue
        if (total > maxBytes - count) return null
        output.write(buffer, 0, count)
        total += count
    }
    return output.toByteArray()
}

private fun createTempPhotoUri(context: Context): Uri {
    val file = File(context.cacheDir, "capture_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

private fun createTempVideoUri(context: Context): Uri {
    val file = File(context.cacheDir, "capture_${System.currentTimeMillis()}.mp4")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

@Composable
actual fun rememberPhotoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit {
    val context = LocalContext.current
    var captureUri by remember { mutableStateOf<Uri?>(null) }
    var pendingLaunch by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        onResult(if (success) captureUri?.toString() else null)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted && pendingLaunch) {
            pendingLaunch = false
            val uri = createTempPhotoUri(context)
            captureUri = uri
            cameraLauncher.launch(uri)
        }
    }

    return {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            val uri = createTempPhotoUri(context)
            captureUri = uri
            cameraLauncher.launch(uri)
        } else {
            pendingLaunch = true
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }
}

@Composable
actual fun rememberVideoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit {
    val context = LocalContext.current
    var captureUri by remember { mutableStateOf<Uri?>(null) }
    var pendingLaunch by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CaptureVideo()) { success ->
        onResult(if (success) captureUri?.toString() else null)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted && pendingLaunch) {
            pendingLaunch = false
            val uri = createTempVideoUri(context)
            captureUri = uri
            cameraLauncher.launch(uri)
        }
    }

    return {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            val uri = createTempVideoUri(context)
            captureUri = uri
            cameraLauncher.launch(uri)
        } else {
            pendingLaunch = true
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }
}

@Composable
actual fun rememberGalleryPickerLauncher(mode: MediaCaptureMode, onResult: (String?) -> Unit): () -> Unit {
    val mediaType = when (mode) {
        MediaCaptureMode.PHOTO -> ActivityResultContracts.PickVisualMedia.ImageOnly
        MediaCaptureMode.VIDEO -> ActivityResultContracts.PickVisualMedia.VideoOnly
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        onResult(uri?.toString())
    }
    return { launcher.launch(PickVisualMediaRequest(mediaType)) }
}
