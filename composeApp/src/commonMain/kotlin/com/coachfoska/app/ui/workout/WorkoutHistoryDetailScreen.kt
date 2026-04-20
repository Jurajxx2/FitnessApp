package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutHistoryDetailRoute(
    logId: String,
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(logId) {
        viewModel.onIntent(WorkoutIntent.SelectWorkoutLog(logId))
    }

    WorkoutHistoryDetailScreen(
        state = state,
        onBackClick = onBackClick,
        onCaptureVideo = { exerciseLogId ->
            // In a real app, this would launch the camera
            // For now, we just trigger the intent with dummy data
            viewModel.onIntent(WorkoutIntent.AttachVideoToLog(exerciseLogId, byteArrayOf()))
        }
    )
}

@Composable
fun WorkoutHistoryDetailScreen(
    state: WorkoutState,
    onBackClick: () -> Unit,
    onCaptureVideo: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "SESSION DETAIL", onBackClick = onBackClick)
        if (state.isHistoryLoading && state.selectedWorkoutLog == null) {
            CoachLoadingBox(Modifier.weight(1f))
        } else {
            state.selectedWorkoutLog?.let { log ->
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(bottom = 32.dp)
                ) {
                    item {
                        Column(modifier = Modifier.padding(24.dp)) {
                            Text(
                                text = log.loggedAt.toDisplayDateTime().uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = log.workoutName,
                                style = MaterialTheme.typography.displayMedium,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                            
                            Row(
                                modifier = Modifier.padding(top = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "${log.durationMinutes} MIN",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                )
                                Box(modifier = Modifier.size(3.dp).background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)))
                                Text(
                                    text = "${log.exerciseLogs.size} EXERCISES",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                )
                            }

                            if (log.notes != null) {
                                Spacer(modifier = Modifier.height(24.dp))
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = log.notes,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                                        modifier = Modifier.padding(16.dp)
                                    )
                                }
                            }
                        }
                    }

                    items(log.exerciseLogs) { exerciseLog ->
                        ExerciseLogDetailRow(
                            log = exerciseLog,
                            onCaptureVideo = { onCaptureVideo(exerciseLog.id) }
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 24.dp),
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)
                        )
                    }
                }
            } ?: Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Text(text = "Log not found", color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f))
            }
        }
    }
}

@Composable
private fun ExerciseLogDetailRow(
    log: ExerciseLog,
    onCaptureVideo: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.background,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(24.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = log.exerciseName,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.Bold
                )
                
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${log.setsCompleted} SETS",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                    )
                    if (log.repsCompleted != null) {
                        Box(modifier = Modifier.size(2.dp).background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)))
                        Text(
                            text = "${log.repsCompleted} REPS",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                        )
                    }
                    if (log.weightKg != null) {
                        Box(modifier = Modifier.size(2.dp).background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)))
                        Text(
                            text = "${log.weightKg} KG",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                        )
                    }
                }
            }
            
            IconButton(
                onClick = onCaptureVideo,
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                    contentColor = MaterialTheme.colorScheme.onBackground
                ),
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Videocam,
                    contentDescription = "Capture Video",
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
