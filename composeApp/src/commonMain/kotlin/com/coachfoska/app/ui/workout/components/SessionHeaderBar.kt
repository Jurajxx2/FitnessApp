package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SessionDraft

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionHeaderBar(
    draft: SessionDraft?,
    elapsedSeconds: Long,
    onBackClick: () -> Unit,
    onFinishClick: () -> Unit,
    onDiscardClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val minutes = elapsedSeconds / 60
    val seconds = elapsedSeconds % 60
    val timerText = "%d:%02d".format(minutes, seconds)

    val totalVolume = draft?.exercises?.sumOf { ex ->
        ex.sets.filter { it.completed }.sumOf { s ->
            ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
        }
    }?.toFloat() ?: 0f
    val volumeText = if (totalVolume >= 1000f) {
        "${formatWeightKg(totalVolume / 1000f)}t"
    } else {
        "${formatWeightKg(totalVolume)}kg"
    }

    TopAppBar(
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = draft?.workoutName?.uppercase() ?: "WORKOUT",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                )
                Text(
                    text = timerText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = volumeText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        },
        actions = {
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "More options")
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("Finish workout") },
                        onClick = { menuExpanded = false; onFinishClick() },
                    )
                    DropdownMenuItem(
                        text = { Text("Discard workout", color = MaterialTheme.colorScheme.error) },
                        onClick = { menuExpanded = false; onDiscardClick() },
                    )
                }
            }
        },
        modifier = modifier,
    )
}
