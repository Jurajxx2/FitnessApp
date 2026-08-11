package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

enum class MediaCaptureMode { PHOTO, VIDEO }

@Composable
expect fun rememberPhotoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit

@Composable
expect fun rememberVideoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit

@Composable
expect fun rememberGalleryPickerLauncher(mode: MediaCaptureMode, onResult: (String?) -> Unit): () -> Unit

/** Returns a URI reader. When [maxBytes] is set, it must stop before allocating beyond the cap. */
@Composable
expect fun rememberUriBytesReader(maxBytes: Int? = null): (String) -> ByteArray?
