package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

@Composable
actual fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit {
    val context = LocalContext.current
    return {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_EAN_13,
                Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_UPC_A,
                Barcode.FORMAT_UPC_E,
            )
            .build()
        GmsBarcodeScanning.getClient(context, options)
            .startScan()
            .addOnSuccessListener { barcode -> onResult(barcode.rawValue) }
            .addOnCanceledListener { onResult(null) }
            .addOnFailureListener { onResult(null) }
    }
}
