package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

/**
 * Returns a function that launches a barcode scanner. On a successful scan the raw barcode value
 * is delivered; on cancel/failure/unsupported-platform, null is delivered.
 */
@Composable
expect fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit
