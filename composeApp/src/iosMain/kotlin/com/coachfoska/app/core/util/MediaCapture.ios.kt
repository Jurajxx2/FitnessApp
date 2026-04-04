package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

@Composable
actual fun rememberPhotoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit = { onResult(null) }

@Composable
actual fun rememberVideoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit = { onResult(null) }

@Composable
actual fun rememberGalleryPickerLauncher(mode: MediaCaptureMode, onResult: (String?) -> Unit): () -> Unit = { onResult(null) }

@Composable
actual fun rememberUriBytesReader(): (String) -> ByteArray? = { null }
