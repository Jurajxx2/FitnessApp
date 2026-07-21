package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme
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
import androidx.compose.material.icons.filled.Info
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
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.duration_min
import coachfoska.composeapp.generated.resources.exercise_detail_title
import coachfoska.composeapp.generated.resources.exercises_count
import coachfoska.composeapp.generated.resources.workout_history_capture_video_cd
import coachfoska.composeapp.generated.resources.workout_history_detail_title
import coachfoska.composeapp.generated.resources.workout_history_log_not_found
import coachfoska.composeapp.generated.resources.workout_history_rpe_header
import coachfoska.composeapp.generated.resources.workout_history_reps_header
import coachfoska.composeapp.generated.resources.workout_history_time_header
import coachfoska.composeapp.generated.resources.workout_history_sets_format
import coachfoska.composeapp.generated.resources.workout_history_weight_header
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutFeedback
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.model.formatDuration
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsTopBar
import kotlinx.datetime.Instant
import androidx.compose.ui.tooling.preview.Preview
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutHistoryDetailRoute(
    logId: String,
    userId: String,
    onBackClick: () -> Unit,
    onExerciseDetailClick: (exerciseId: String?, exerciseName: String) -> Unit = { _, _ -> },
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(logId) {
        viewModel.onIntent(WorkoutIntent.SelectWorkoutLog(logId))
    }

    WorkoutHistoryDetailScreen(
        state = state,
        onBackClick = onBackClick,
        onExerciseDetailClick = onExerciseDetailClick,
        onCaptureVideo = { exerciseLogId ->
            viewModel.onIntent(WorkoutIntent.AttachVideoToLog(exerciseLogId, byteArrayOf()))
        },
    )
}

@Composable
fun WorkoutHistoryDetailScreen(
    state: WorkoutState,
    onBackClick: () -> Unit,
    onExerciseDetailClick: (exerciseId: String?, exerciseName: String) -> Unit = { _, _ -> },
    onCaptureVideo: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        DsTopBar(title = stringResource(Res.string.workout_history_detail_title), onBackClick = onBackClick, backContentDescription = stringResource(Res.string.back_cd))
        if (state.isHistoryLoading && state.selectedWorkoutLog == null) {
            DsLoadingBox(Modifier.weight(1f))
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
                            onExerciseDetailClick = {
                                onExerciseDetailClick(exerciseLog.exerciseId, exerciseLog.exerciseName)
                            },
                            onCaptureVideo = { onCaptureVideo(exerciseLog.id) },
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 24.dp),
                            color = DsTheme.colors.textPrimary.copy(alpha = 0.05f),
                        )
                    }
                }
            } ?: Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Text(text = stringResource(Res.string.workout_history_log_not_found), color = DsTheme.colors.textPrimary.copy(alpha = 0.5f))
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
            color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
            letterSpacing = 1.sp,
        )
        Text(
            text = log.workoutName,
            style = MaterialTheme.typography.displayMedium,
            color = DsTheme.colors.textPrimary,
        )
        Row(
            modifier = Modifier.padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(Res.string.duration_min, log.durationMinutes),
                style = MaterialTheme.typography.titleSmall,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
            )
            Box(
                modifier = Modifier
                    .size(3.dp)
                    .background(DsTheme.colors.textPrimary.copy(alpha = 0.2f), RoundedCornerShape(50)),
            )
            Text(
                text = stringResource(Res.string.exercises_count, log.exerciseLogs.size),
                style = MaterialTheme.typography.titleSmall,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
            )
        }

        if (log.notes != null) {
            Spacer(modifier = Modifier.height(24.dp))
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = DsTheme.colors.surfaceElevated.copy(alpha = 0.2f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = log.notes,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.8f),
                    modifier = Modifier.padding(16.dp),
                )
            }
        }

        if (log.feedback.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            FeedbackList(feedback = log.feedback)
        }
    }
}

@Composable
private fun ExerciseLogDetailRow(
    log: ExerciseLog,
    onExerciseDetailClick: () -> Unit,
    onCaptureVideo: () -> Unit,
) {
    var expanded by rememberSaveable(log.id) { mutableStateOf(false) }

    Surface(
        color = DsTheme.colors.background,
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
                        color = DsTheme.colors.textPrimary,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = stringResource(Res.string.workout_history_sets_format, log.setsCompletedCount),
                        style = MaterialTheme.typography.labelSmall,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                    )
                }
                if (log.summaryLine.isNotEmpty()) {
                    Text(
                        text = log.summaryLine,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
                    )
                }
                if (expanded && log.sets.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    val isTimed = log.isTimedExercise()
                    SetTableHeader(isTimed)
                    log.sets.forEach { set -> SetTableRow(set, isTimed) }
                }
                if (log.feedback.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    FeedbackList(feedback = log.feedback)
                }
            }

            IconButton(
                onClick = onExerciseDetailClick,
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = DsTheme.colors.textPrimary.copy(alpha = 0.05f),
                    contentColor = DsTheme.colors.actionPrimary,
                ),
                modifier = Modifier.size(48.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = stringResource(Res.string.exercise_detail_title),
                    modifier = Modifier.size(20.dp),
                )
            }

            IconButton(
                onClick = onCaptureVideo,
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = DsTheme.colors.textPrimary.copy(alpha = 0.05f),
                    contentColor = DsTheme.colors.textPrimary,
                ),
                modifier = Modifier.size(48.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.Videocam,
                    contentDescription = stringResource(Res.string.workout_history_capture_video_cd),
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

@Composable
private fun FeedbackList(feedback: List<WorkoutFeedback>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Coach feedback",
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.actionPrimary,
            letterSpacing = 1.sp,
        )
        feedback.forEach { item ->
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = DsTheme.colors.actionPrimary.copy(alpha = 0.08f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = item.body,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.85f),
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = item.createdAt.toDisplayDateTime(),
                        style = MaterialTheme.typography.labelSmall,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                    )
                }
            }
        }
    }
}

@Composable
private fun SetTableHeader(isTimed: Boolean) {
    Row {
        Text("#", modifier = Modifier.width(32.dp), style = MaterialTheme.typography.labelSmall)
        Text(stringResource(if (isTimed) Res.string.workout_history_time_header else Res.string.workout_history_reps_header), modifier = Modifier.width(64.dp), style = MaterialTheme.typography.labelSmall)
        if (!isTimed) {
            Text(stringResource(Res.string.workout_history_weight_header), modifier = Modifier.width(80.dp), style = MaterialTheme.typography.labelSmall)
            Text(stringResource(Res.string.workout_history_rpe_header), modifier = Modifier.width(48.dp), style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun SetTableRow(set: SetLog, isTimed: Boolean) {
    Row {
        Text(set.sortOrder.toString(), modifier = Modifier.width(32.dp))
        Text(
            if (isTimed) (set.actualDurationSeconds ?: set.actualRestSeconds)?.let(::formatDuration) ?: "-" else set.actualReps?.toString() ?: "-",
            modifier = Modifier.width(64.dp),
        )
        if (!isTimed) {
            Text(set.actualWeightKg?.let { "${formatWeightKg(it)} kg" } ?: "-", modifier = Modifier.width(80.dp))
            Text(set.rpe?.toString() ?: "-", modifier = Modifier.width(48.dp))
        }
    }
}

private fun ExerciseLog.isTimedExercise(): Boolean =
    sets.isNotEmpty() &&
        sets.all { it.actualReps == null && it.actualWeightKg == null } &&
        sets.any { it.actualDurationSeconds != null || it.actualRestSeconds != null }

@Preview
@Composable
private fun WorkoutHistoryDetailScreenPreviewNewFormat() {
    WorkoutHistoryDetailScreen(
        state = WorkoutState(selectedWorkoutLog = previewWorkoutLog(newFormat = true)),
        onBackClick = {},
        onExerciseDetailClick = { _, _ -> },
        onCaptureVideo = {},
    )
}

@Preview
@Composable
private fun WorkoutHistoryDetailScreenPreviewLegacyFallback() {
    WorkoutHistoryDetailScreen(
        state = WorkoutState(selectedWorkoutLog = previewWorkoutLog(newFormat = false)),
        onBackClick = {},
        onExerciseDetailClick = { _, _ -> },
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
