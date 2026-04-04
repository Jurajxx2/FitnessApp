package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.app.core.util.rememberGalleryPickerLauncher
import com.coachfoska.app.core.util.rememberPhotoCaptureLauncher
import com.coachfoska.app.core.util.rememberVideoCaptureLauncher

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediaCaptureBottomSheet(
    mode: MediaCaptureMode,
    onDismiss: () -> Unit,
    onResult: (String?) -> Unit
) {
    val dismiss: (String?) -> Unit = { uri -> onDismiss(); onResult(uri) }

    val capturePhoto = rememberPhotoCaptureLauncher { dismiss(it) }
    val captureVideo = rememberVideoCaptureLauncher { dismiss(it) }
    val pickFromGallery = rememberGalleryPickerLauncher(mode) { dismiss(it) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        ) {
            Text(
                text = if (mode == MediaCaptureMode.PHOTO) "ADD PHOTO" else "ADD VIDEO",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)
            )
            if (mode == MediaCaptureMode.PHOTO) {
                MediaSheetOption(
                    icon = Icons.Default.CameraAlt,
                    label = "Take Photo",
                    onClick = { capturePhoto() }
                )
                MediaSheetOption(
                    icon = Icons.Default.Image,
                    label = "Upload from Gallery",
                    onClick = { pickFromGallery() }
                )
            } else {
                MediaSheetOption(
                    icon = Icons.Default.Videocam,
                    label = "Record Video",
                    onClick = { captureVideo() }
                )
                MediaSheetOption(
                    icon = Icons.Default.Image,
                    label = "Upload from Gallery",
                    onClick = { pickFromGallery() }
                )
            }
        }
    }
}

@Composable
private fun MediaSheetOption(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge
            )
        }
    }
}
