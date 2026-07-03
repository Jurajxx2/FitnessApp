package com.coachfoska.app.ui.workout

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.activity_hub_workout_history
import coachfoska.composeapp.generated.resources.duration_min
import coachfoska.composeapp.generated.resources.exercises_count
import coachfoska.composeapp.generated.resources.workout_history_no_workouts
import coachfoska.composeapp.generated.resources.workout_history_progress_desc
import coachfoska.composeapp.generated.resources.workout_history_volume_format
import coachfoska.composeapp.generated.resources.workout_history_your_progress
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutHistoryRoute(
    userId: String,
    onBackClick: () -> Unit,
    onLogClick: (String) -> Unit,
    onProgressClick: () -> Unit = {},
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    WorkoutHistoryScreen(state = state, onBackClick = onBackClick, onLogClick = onLogClick, onProgressClick = onProgressClick)
}

@Composable
fun WorkoutHistoryScreen(
    state: WorkoutState,
    onBackClick: () -> Unit,
    onLogClick: (String) -> Unit,
    onProgressClick: () -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = stringResource(Res.string.activity_hub_workout_history), onBackClick = onBackClick)
        if (state.isHistoryLoading) {
            CoachLoadingBox(Modifier.weight(1f))
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Progress dashboard card
                item {
                    Card(
                        onClick = onProgressClick,
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text("📊", fontSize = 24.sp)
                            Column {
                                Text(
                                    stringResource(Res.string.workout_history_your_progress),
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                )
                                Text(
                                    stringResource(Res.string.workout_history_progress_desc),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                                )
                            }
                        }
                    }
                }

                items(state.workoutHistory) { log ->
                    WorkoutHistoryDetailCard(log = log, onClick = { onLogClick(log.id) })
                }
                if (state.workoutHistory.isEmpty()) {
                    item {
                        Text(
                            text = stringResource(Res.string.workout_history_no_workouts),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WorkoutHistoryDetailCard(log: WorkoutLog, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = log.workoutName,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = log.loggedAt.toDisplayDateTime(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(Res.string.duration_min, log.durationMinutes),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                Box(modifier = Modifier.size(3.dp).background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)))
                Text(
                    text = stringResource(Res.string.exercises_count, log.exerciseLogs.size),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
            }

            // Volume summary
            val totalVolume = log.exerciseLogs.sumOf { ex ->
                ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }
            }.toFloat()
            if (totalVolume > 0f) {
                Text(
                    text = stringResource(Res.string.workout_history_volume_format, formatWeightKg(totalVolume)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                )
            }
        }
    }
}
