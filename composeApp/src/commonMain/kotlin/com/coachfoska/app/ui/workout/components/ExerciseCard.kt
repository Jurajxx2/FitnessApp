package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.exercise_options_cd
import coachfoska.composeapp.generated.resources.exercise_swap
import coachfoska.composeapp.generated.resources.exercise_view_history
import com.coachfoska.app.presentation.workout.ExerciseDraft
import org.jetbrains.compose.resources.stringResource

@Composable
fun ExerciseCardHeader(
    exercise: ExerciseDraft,
    onSwapExercise: () -> Unit,
    onViewHistory: () -> Unit,
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (leading != null) {
            leading()
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = exercise.exerciseName,
                style = MaterialTheme.typography.titleMedium,
            )
            val subtitle = buildString {
                exercise.muscleGroup?.let { append("$it · ") }
                append("${exercise.initialSetsGoal} × ${exercise.initialRepsGoal}")
                exercise.sets.firstOrNull()?.targetRestSeconds?.let { append(" · ${it}s rest") }
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = DsTheme.colors.textSecondary,
            )
        }
        
        Box {
            IconButton(onClick = { menuExpanded = true }) {
                Icon(
                    Icons.Default.MoreVert,
                    contentDescription = stringResource(Res.string.exercise_options_cd),
                )
            }
            DropdownMenu(
                expanded = menuExpanded,
                onDismissRequest = { menuExpanded = false },
            ) {
                DropdownMenuItem(
                    text = { Text(stringResource(Res.string.exercise_swap)) },
                    onClick = { menuExpanded = false; onSwapExercise() },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(Res.string.exercise_view_history)) },
                    onClick = { menuExpanded = false; onViewHistory() },
                )
            }
        }
    }
}
