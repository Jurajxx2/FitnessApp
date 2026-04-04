package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

enum class MediaCaptureMode { PHOTO, VIDEO }

@Composable
expect fun rememberPhotoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit

@Composable
expect fun rememberVideoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit

@Composable
expect fun rememberGalleryPickerLauncher(mode: MediaCaptureMode, onResult: (String?) -> Unit): () -> Unit

/** Returns a function that reads a URI string into bytes, or null if unavailable. */
@Composable
expect fun rememberUriBytesReader(): (String) -> ByteArray?
