package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.app.ui.components.MediaCaptureBottomSheet
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun LogWorkoutRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.workoutLoggedSuccess) {
        if (state.workoutLoggedSuccess) {
            viewModel.onIntent(WorkoutIntent.WorkoutLogged)
            onBackClick()
        }
    }

    LogWorkoutScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@Composable
fun LogWorkoutScreen(
    state: WorkoutState,
    onIntent: (WorkoutIntent) -> Unit,
    onBackClick: () -> Unit
) {
    var workoutName by remember { mutableStateOf("") }
    var durationMinutes by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var exercises by remember { mutableStateOf(listOf(LogWorkoutFlatDraftRow(""))) }
    var videoSheetForIndex by remember { mutableStateOf<Int?>(null) }

    videoSheetForIndex?.let { index ->
        MediaCaptureBottomSheet(
            mode = MediaCaptureMode.VIDEO,
            onDismiss = { videoSheetForIndex = null },
            onResult = { uri ->
                if (uri != null) {
                    exercises = exercises.toMutableList().also { it[index] = it[index].copy(videoUrl = uri) }
                }
                videoSheetForIndex = null
            }
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "LOG SESSION", onBackClick = onBackClick)
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CoachTextField(
                    value = workoutName,
                    onValueChange = { workoutName = it },
                    label = "WORKOUT NAME"
                )
                CoachTextField(
                    value = durationMinutes,
                    onValueChange = { durationMinutes = it },
                    label = "DURATION (MINS)",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
            }

            CoachSectionHeader(text = "EXERCISES")

            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                exercises.forEachIndexed { i, exercise ->
                    ExerciseLogRow(
                        index = i + 1,
                        exercise = exercise,
                        onUpdate = { updated ->
                            exercises = exercises.toMutableList().also { it[i] = updated }
                        },
                        onRemove = if (exercises.size > 1) ({
                            exercises = exercises.toMutableList().also { it.removeAt(i) }
                        }) else null,
                        onAddVideo = { videoSheetForIndex = i }
                    )
                }
                
                Button(
                    onClick = { exercises = exercises + LogWorkoutFlatDraftRow("") },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f), contentColor = MaterialTheme.colorScheme.onBackground)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("ADD EXERCISE")
                }
            }

            CoachSectionHeader(text = "NOTES")
            CoachTextField(
                value = notes,
                onValueChange = { notes = it },
                label = "Workout notes (optional)",
                modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp),
                singleLine = false
            )

            CoachButton(
                text = "SAVE WORKOUT",
                onClick = {
                    onIntent(
                        WorkoutIntent.LogWorkout(
                            workoutId = null,
                            workoutName = workoutName,
                            durationMinutes = durationMinutes.toIntOrNull() ?: 0,
                            notes = notes.takeIf { it.isNotBlank() },
                            exerciseLogs = logWorkoutFlatRowsToExerciseLogs(exercises.filter { it.exerciseName.isNotBlank() && it.setsCompleted > 0 })
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth().height(56.dp).navigationBarsPadding(),
                isLoading = state.isLogging,
                enabled = workoutName.isNotBlank() && exercises.any { it.exerciseName.isNotBlank() && it.setsCompleted > 0 }
            )

            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun ExerciseLogRow(
    index: Int,
    exercise: LogWorkoutFlatDraftRow,
    onUpdate: (LogWorkoutFlatDraftRow) -> Unit,
    onRemove: (() -> Unit)?,
    onAddVideo: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "EXERCISE #$index",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = onAddVideo,
                        modifier = Modifier.size(32.dp),
                        colors = IconButtonDefaults.iconButtonColors(
                            containerColor = if (exercise.videoUrl != null)
                                MaterialTheme.colorScheme.onBackground
                            else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                            contentColor = if (exercise.videoUrl != null)
                                MaterialTheme.colorScheme.background
                            else MaterialTheme.colorScheme.onBackground
                        )
                    ) {
                        Icon(
                            imageVector = if (exercise.videoUrl != null) Icons.Default.Check else Icons.Default.Videocam,
                            contentDescription = stringResource(Res.string.add_video_cd),
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    if (onRemove != null) {
                        IconButton(onClick = onRemove, modifier = Modifier.size(24.dp)) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = stringResource(Res.string.remove_cd),
                                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            CoachTextField(
                value = exercise.exerciseName,
                onValueChange = { onUpdate(exercise.copy(exerciseName = it)) },
                label = "EXERCISE NAME"
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CoachTextField(
                    value = exercise.setsCompleted.takeIf { it > 0 }?.toString() ?: "",
                    onValueChange = { onUpdate(exercise.copy(setsCompleted = it.toIntOrNull() ?: 0)) },
                    label = "SETS",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                CoachTextField(
                    value = exercise.reps,
                    onValueChange = { onUpdate(exercise.copy(reps = it)) },
                    label = "REPS",
                    modifier = Modifier.weight(1f)
                )
                CoachTextField(
                    value = exercise.weightKg?.toString() ?: "",
                    onValueChange = { onUpdate(exercise.copy(weightKg = it.toFloatOrNull())) },
                    label = "KG",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }
        }
    }
}

private data class LogWorkoutFlatDraftRow(
    val exerciseName: String,
    val setsCompleted: Int = 0,
    val reps: String = "",
    val weightKg: Float? = null,
    val videoUrl: String? = null
)

private fun logWorkoutFlatRowsToExerciseLogs(rows: List<LogWorkoutFlatDraftRow>): List<ExerciseLog> =
    rows.map { row ->
        val parsedReps = row.reps.trim().substringBefore('-').filter { it.isDigit() }.toIntOrNull()
        val sets = (1..row.setsCompleted).map { order ->
            SetLog(
                id = "", exerciseLogId = "", sortOrder = order,
                targetReps = parsedReps, actualReps = parsedReps,
                targetWeightKg = row.weightKg, actualWeightKg = row.weightKg,
                rpe = null,
                targetRestSeconds = null, actualRestSeconds = null,
                completed = true,
            )
        }
        ExerciseLog(
            id = "", workoutLogId = "",
            exerciseName = row.exerciseName, notes = null,
            sets = sets,
            videoUrl = row.videoUrl
        )
    }
