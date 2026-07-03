package com.coachfoska.app.ui.hydration.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_delete
import coachfoska.composeapp.generated.resources.common_favorite_cd
import coachfoska.composeapp.generated.resources.hydration_add_container
import coachfoska.composeapp.generated.resources.hydration_add_new
import coachfoska.composeapp.generated.resources.hydration_container_name_label
import coachfoska.composeapp.generated.resources.hydration_container_volume_label
import coachfoska.composeapp.generated.resources.hydration_my_containers
import com.coachfoska.app.domain.model.WaterContainer
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTextField
import org.jetbrains.compose.resources.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageContainersSheet(
    containers: List<WaterContainer>,
    onAdd: (name: String, volumeMl: Int) -> Unit,
    onDelete: (containerId: String) -> Unit,
    onToggleFavorite: (containerId: String, isFavorite: Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    val favoriteLabel = stringResource(Res.string.common_favorite_cd)
    val deleteLabel = stringResource(Res.string.common_delete)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        containerColor = MaterialTheme.colorScheme.background,
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(24.dp)) {
            Text(
                text = stringResource(Res.string.hydration_my_containers),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(16.dp))
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.heightIn(max = 300.dp),
            ) {
                items(items = containers, key = { it.id }) { c ->
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.04f),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(c.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                Text("${c.volumeMl} ml", style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f))
                            }
                            IconButton(onClick = { onToggleFavorite(c.id, !c.isFavorite) }) {
                                Icon(
                                    imageVector = if (c.isFavorite) Icons.Filled.Star else Icons.Outlined.StarBorder,
                                    contentDescription = favoriteLabel,
                                    tint = if (c.isFavorite) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                            IconButton(onClick = { onDelete(c.id) }) {
                                Icon(
                                    Icons.Filled.Delete,
                                    contentDescription = deleteLabel,
                                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(Res.string.hydration_add_new),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            )
            Spacer(Modifier.height(8.dp))

            var name by remember { mutableStateOf("") }
            var volume by remember { mutableStateOf("") }

            CoachTextField(value = name, onValueChange = { name = it }, label = stringResource(Res.string.hydration_container_name_label))
            Spacer(Modifier.height(8.dp))
            CoachTextField(
                value = volume,
                onValueChange = { volume = it.filter { c -> c.isDigit() }.take(5) },
                label = stringResource(Res.string.hydration_container_volume_label),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            Spacer(Modifier.height(12.dp))
            CoachButton(
                text = stringResource(Res.string.hydration_add_container),
                onClick = {
                    val ml = volume.toIntOrNull() ?: 0
                    if (name.isNotBlank() && ml > 0) {
                        onAdd(name.trim(), ml)
                        name = ""
                        volume = ""
                    }
                },
                enabled = name.isNotBlank() && (volume.toIntOrNull() ?: 0) > 0,
            )
        }
    }
}
