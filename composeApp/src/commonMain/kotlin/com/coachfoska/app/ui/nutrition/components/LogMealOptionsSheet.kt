package com.coachfoska.app.ui.nutrition.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.app.core.util.rememberGalleryPickerLauncher
import com.coachfoska.app.core.util.rememberPhotoCaptureLauncher

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogMealOptionsSheet(
    onDismiss: () -> Unit,
    onManual: () -> Unit,
    onPhotoPicked: (String) -> Unit
) {
    val takePhoto = rememberPhotoCaptureLauncher { uri ->
        if (uri != null) { onDismiss(); onPhotoPicked(uri) }
    }
    val pickPhoto = rememberGalleryPickerLauncher(MediaCaptureMode.PHOTO) { uri ->
        if (uri != null) { onDismiss(); onPhotoPicked(uri) }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
            Text(
                text = "LOG MEAL",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                letterSpacing = 1.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)
            )
            LogMealOption(Icons.Default.CameraAlt, "Take Photo") { takePhoto() }
            LogMealOption(Icons.Default.Image, "Choose Photo") { pickPhoto() }
            LogMealOption(Icons.Default.Edit, "Enter Manually") { onDismiss(); onManual() }
        }
    }
}

@Composable
private fun LogMealOption(icon: ImageVector, label: String, onClick: () -> Unit) {
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
            Text(label, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
