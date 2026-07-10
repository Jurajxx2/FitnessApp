package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.editor_move_down_cd
import coachfoska.composeapp.generated.resources.editor_move_up_cd
import coachfoska.composeapp.generated.resources.exercise_options_cd
import coachfoska.composeapp.generated.resources.exercise_detail_title
import coachfoska.composeapp.generated.resources.exercise_swap
import coachfoska.composeapp.generated.resources.exercise_view_history
import com.coachfoska.app.presentation.workout.ExerciseDraft
import org.jetbrains.compose.resources.stringResource

@Composable
fun ExerciseCardHeader(
    exercise: ExerciseDraft,
    onSwapExercise: () -> Unit,
    onViewHistory: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val canOpenDetail = exercise.exerciseId?.isNotBlank() == true || exercise.exerciseName.isNotBlank()

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (leading != null) {
            leading()
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .then(
                    if (canOpenDetail) Modifier.clickable(onClick = onViewHistory)
                    else Modifier
                )
        ) {
            Text(
                text = exercise.exerciseName,
                style = MaterialTheme.typography.titleMedium,
                color = if (canOpenDetail) DsTheme.colors.actionPrimary else DsTheme.colors.textPrimary,
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

        IconButton(
            onClick = onViewHistory,
            enabled = canOpenDetail,
        ) {
            Icon(
                imageVector = Icons.Default.Info,
                contentDescription = stringResource(Res.string.exercise_detail_title),
                tint = if (canOpenDetail) DsTheme.colors.actionPrimary else DsTheme.colors.textSecondary.copy(alpha = 0.35f),
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
                    text = { Text(stringResource(Res.string.editor_move_up_cd)) },
                    enabled = canMoveUp,
                    onClick = { menuExpanded = false; onMoveUp() },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(Res.string.editor_move_down_cd)) },
                    enabled = canMoveDown,
                    onClick = { menuExpanded = false; onMoveDown() },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(Res.string.exercise_view_history)) },
                    enabled = canOpenDetail,
                    onClick = { menuExpanded = false; onViewHistory() },
                )
            }
        }
    }
}
