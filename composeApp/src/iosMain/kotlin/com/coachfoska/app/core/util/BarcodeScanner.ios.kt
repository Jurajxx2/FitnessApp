package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

// iOS camera is a stub target (see MediaCapture.ios.kt) - barcode scanning is a no-op until the
// iOS app gains real camera support (Xcode project + NSCameraUsageDescription).
@Composable
actual fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit = { onResult(null) }
