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
import java.io.File

@Composable
actual fun rememberUriBytesReader(): (String) -> ByteArray? {
    val context = LocalContext.current
    return { uriString ->
        runCatching {
            val uri = Uri.parse(uriString)
            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        }.getOrNull()
    }
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
