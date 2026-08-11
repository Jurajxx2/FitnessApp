package com.coachfoska.app.core.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.os.Build
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

@Composable
actual fun rememberCheckInPhotoReader(): (String) -> ByteArray? {
    val context = LocalContext.current
    return { uriString ->
        runCatching { prepareCheckInPhoto(context, Uri.parse(uriString)) }.getOrNull()
    }
}

private fun prepareCheckInPhoto(context: Context, uri: Uri): ByteArray {
    var bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            val dimensions = fitCheckInPhotoDimensions(info.size.width, info.size.height)
            decoder.setTargetSize(dimensions.width, dimensions.height)
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    } else {
        decodeSampledBitmap(context, uri)
    }

    val initial = fitCheckInPhotoDimensions(bitmap.width, bitmap.height)
    if (bitmap.width != initial.width || bitmap.height != initial.height) {
        val scaled = Bitmap.createScaledBitmap(bitmap, initial.width, initial.height, true)
        if (scaled !== bitmap) bitmap.recycle()
        bitmap = scaled
    }

    try {
        repeat(5) {
            for (quality in intArrayOf(86, 76, 66, 56)) {
                val output = ByteArrayOutputStream()
                check(bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) { "JPEG encoding failed" }
                val bytes = output.toByteArray()
                if (bytes.size <= MAX_CHECK_IN_PHOTO_BYTES) return bytes
            }
            val nextWidth = maxOf(1, (bitmap.width * 0.78).toInt())
            val nextHeight = maxOf(1, (bitmap.height * 0.78).toInt())
            val scaled = Bitmap.createScaledBitmap(bitmap, nextWidth, nextHeight, true)
            if (scaled !== bitmap) bitmap.recycle()
            bitmap = scaled
        }
        error("Unable to prepare image below 5 MiB")
    } finally {
        bitmap.recycle()
    }
}

private fun decodeSampledBitmap(context: Context, uri: Uri): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        ?: error("Unable to open selected image")
    check(bounds.outWidth > 0 && bounds.outHeight > 0) { "Unable to read selected image dimensions" }

    val options = BitmapFactory.Options().apply {
        inSampleSize = calculateCheckInDecodeSampleSize(bounds.outWidth, bounds.outHeight)
    }
    return context.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, options)
    } ?: error("Unable to decode selected image")
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
