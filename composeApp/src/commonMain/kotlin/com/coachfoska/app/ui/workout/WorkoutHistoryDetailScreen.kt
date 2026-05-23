package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import kotlinx.datetime.Instant
import androidx.compose.ui.tooling.preview.Preview
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutHistoryDetailRoute(
    logId: String,
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(logId) {
        viewModel.onIntent(WorkoutIntent.SelectWorkoutLog(logId))
    }

    WorkoutHistoryDetailScreen(
        state = state,
        onBackClick = onBackClick,
        onCaptureVideo = { exerciseLogId ->
            viewModel.onIntent(WorkoutIntent.AttachVideoToLog(exerciseLogId, byteArrayOf()))
        },
    )
}

@Composable
fun WorkoutHistoryDetailScreen(
    state: WorkoutState,
    onBackClick: () -> Unit,
    onCaptureVideo: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "SESSION DETAIL", onBackClick = onBackClick)
        if (state.isHistoryLoading && state.selectedWorkoutLog == null) {
            CoachLoadingBox(Modifier.weight(1f))
        } else {
            state.selectedWorkoutLog?.let { log ->
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(bottom = 32.dp),
                ) {
                    item { WorkoutLogHeader(log) }
                    items(log.exerciseLogs) { exerciseLog ->
                        ExerciseLogDetailRow(
                            log = exerciseLog,
                            onCaptureVideo = { onCaptureVideo(exerciseLog.id) },
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 24.dp),
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
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
private fun WorkoutLogHeader(log: WorkoutLog) {
    Column(modifier = Modifier.padding(24.dp)) {
        Text(
            text = log.loggedAt.toDisplayDateTime().uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp,
        )
        Text(
            text = log.workoutName,
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Row(
            modifier = Modifier.padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "${log.durationMinutes} MIN",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
            )
            Box(
                modifier = Modifier
                    .size(3.dp)
                    .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)),
            )
            Text(
                text = "${log.exerciseLogs.size} EXERCISES",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
            )
        }

        if (log.notes != null) {
            Spacer(modifier = Modifier.height(24.dp))
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = log.notes,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
    }
}

@Composable
private fun ExerciseLogDetailRow(
    log: ExerciseLog,
    onCaptureVideo: () -> Unit,
) {
    var expanded by rememberSaveable(log.id) { mutableStateOf(false) }

    Surface(
        color = MaterialTheme.colorScheme.background,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(24.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { expanded = !expanded },
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = log.exerciseName,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onBackground,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = "${log.setsCompletedCount} SETS",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    )
                }
                if (log.summaryLine.isNotEmpty()) {
                    Text(
                        text = log.summaryLine,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    )
                }
                if (expanded && log.sets.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    SetTableHeader()
                    log.sets.forEach { set -> SetTableRow(set) }
                }
            }

            IconButton(
                onClick = onCaptureVideo,
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                    contentColor = MaterialTheme.colorScheme.onBackground,
                ),
                modifier = Modifier.size(48.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.Videocam,
                    contentDescription = "Capture Video",
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

@Composable
private fun SetTableHeader() {
    Row {
        Text("#", modifier = Modifier.width(32.dp), style = MaterialTheme.typography.labelSmall)
        Text("Reps", modifier = Modifier.width(64.dp), style = MaterialTheme.typography.labelSmall)
        Text("Weight", modifier = Modifier.width(80.dp), style = MaterialTheme.typography.labelSmall)
        Text("RPE", modifier = Modifier.width(48.dp), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun SetTableRow(set: SetLog) {
    Row {
        Text(set.sortOrder.toString(), modifier = Modifier.width(32.dp))
        Text(set.actualReps?.toString() ?: "-", modifier = Modifier.width(64.dp))
        Text(set.actualWeightKg?.let { "${formatWeightKg(it)} kg" } ?: "-", modifier = Modifier.width(80.dp))
        Text(set.rpe?.toString() ?: "-", modifier = Modifier.width(48.dp))
    }
}

@Preview
@Composable
private fun WorkoutHistoryDetailScreenPreviewNewFormat() {
    WorkoutHistoryDetailScreen(
        state = WorkoutState(selectedWorkoutLog = previewWorkoutLog(newFormat = true)),
        onBackClick = {},
        onCaptureVideo = {},
    )
}

@Preview
@Composable
private fun WorkoutHistoryDetailScreenPreviewLegacyFallback() {
    WorkoutHistoryDetailScreen(
        state = WorkoutState(selectedWorkoutLog = previewWorkoutLog(newFormat = false)),
        onBackClick = {},
        onCaptureVideo = {},
    )
}

private fun previewWorkoutLog(newFormat: Boolean): WorkoutLog = WorkoutLog(
    id = "log-1",
    userId = "user-1",
    workoutId = "workout-1",
    workoutName = if (newFormat) "Push Day" else "Legacy Session",
    durationMinutes = 45,
    notes = "Solid session.",
    loggedAt = Instant.parse("2026-05-21T10:00:00Z"),
    exerciseLogs = listOf(
        ExerciseLog(
            id = "ex-1",
            workoutLogId = "log-1",
            exerciseName = "Bench Press",
            notes = null,
            sets = if (newFormat) {
                listOf(
                    SetLog("s1", "ex-1", 1, 10, 10, null, 60f, 7, 60, null, true),
                    SetLog("s2", "ex-1", 2, 10, 8, null, 60f, 8, 60, null, true),
                )
            } else {
                listOf(
                    SetLog("legacy-1", "ex-1", 1, null, 10, null, 60f, null, null, null, true),
                    SetLog("legacy-2", "ex-1", 2, null, 10, null, 60f, null, null, null, true),
                    SetLog("legacy-3", "ex-1", 3, null, 10, null, 60f, null, null, null, true),
                )
            },
        )
    ),
)
