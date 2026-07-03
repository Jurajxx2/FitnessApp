package com.coachfoska.app.ui.workout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.add_exercise
import coachfoska.composeapp.generated.resources.add_set
import coachfoska.composeapp.generated.resources.add_video_cd
import coachfoska.composeapp.generated.resources.exercise_label
import coachfoska.composeapp.generated.resources.exercises_section
import coachfoska.composeapp.generated.resources.log_session_duration_mins
import coachfoska.composeapp.generated.resources.log_session_exercise_name
import coachfoska.composeapp.generated.resources.log_session_notes
import coachfoska.composeapp.generated.resources.log_session_notes_label
import coachfoska.composeapp.generated.resources.log_session_save_workout
import coachfoska.composeapp.generated.resources.log_session_title
import coachfoska.composeapp.generated.resources.log_session_workout_name
import coachfoska.composeapp.generated.resources.remove_cd
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.theme.Sizes
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.app.ui.components.MediaCaptureBottomSheet
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.tooling.preview.Preview
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun LogWorkoutRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
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
    onBackClick: () -> Unit,
) {
    var workoutName by remember { mutableStateOf("") }
    var durationMinutes by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var exercises by remember { mutableStateOf(listOf(LocalDraftExercise())) }
    var videoSheetForIndex by remember { mutableStateOf<Int?>(null) }

    videoSheetForIndex?.let { index ->
        MediaCaptureBottomSheet(
            mode = MediaCaptureMode.VIDEO,
            onDismiss = { videoSheetForIndex = null },
            onResult = { uri ->
                if (uri != null) {
                    exercises = exercises.toMutableList().also {
                        it[index] = it[index].copy(videoUrl = uri)
                    }
                }
                videoSheetForIndex = null
            },
        )
    }

    LogWorkoutContent(
        workoutName = workoutName,
        onWorkoutName = { workoutName = it },
        durationMinutes = durationMinutes,
        onDurationMinutes = { durationMinutes = it },
        notes = notes,
        onNotes = { notes = it },
        exercises = exercises,
        onExercises = { exercises = it },
        onAddVideo = { videoSheetForIndex = it },
        onBackClick = onBackClick,
        isLogging = state.isLogging,
        onSave = {
            onIntent(
                WorkoutIntent.LogWorkout(
                    workoutId = null,
                    workoutName = workoutName,
                    durationMinutes = durationMinutes.toIntOrNull() ?: 0,
                    notes = notes.takeIf { it.isNotBlank() },
                    exerciseLogs = exercises.toExerciseLogs(),
                )
            )
        },
    )
}

@Composable
private fun LogWorkoutContent(
    workoutName: String,
    onWorkoutName: (String) -> Unit,
    durationMinutes: String,
    onDurationMinutes: (String) -> Unit,
    notes: String,
    onNotes: (String) -> Unit,
    exercises: List<LocalDraftExercise>,
    onExercises: (List<LocalDraftExercise>) -> Unit,
    onAddVideo: (Int) -> Unit,
    onBackClick: () -> Unit,
    isLogging: Boolean,
    onSave: () -> Unit,
) {
    val canSave = workoutName.isNotBlank() &&
        durationMinutes.toIntOrNull()?.let { it > 0 } == true &&
        exercises.any { it.name.isNotBlank() && it.sets.any { set -> set.completed } }

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = stringResource(Res.string.log_session_title), onBackClick = onBackClick)
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CoachTextField(
                    value = workoutName,
                    onValueChange = onWorkoutName,
                    label = stringResource(Res.string.log_session_workout_name),
                )
                CoachTextField(
                    value = durationMinutes,
                    onValueChange = onDurationMinutes,
                    label = stringResource(Res.string.log_session_duration_mins),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }

            CoachSectionHeader(text = stringResource(Res.string.exercises_section))
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                exercises.forEachIndexed { index, exercise ->
                    ManualExerciseCard(
                        index = index,
                        exercise = exercise,
                        onUpdate = { updated ->
                            onExercises(exercises.toMutableList().also { it[index] = updated })
                        },
                        onRemove = if (exercises.size > 1) {
                            { onExercises(exercises.toMutableList().also { it.removeAt(index) }) }
                        } else null,
                        onAddVideo = { onAddVideo(index) },
                    )
                }

                Button(
                    onClick = { onExercises(exercises + LocalDraftExercise()) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                        contentColor = MaterialTheme.colorScheme.onBackground,
                    ),
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.size(8.dp))
                    Text(stringResource(Res.string.add_exercise))
                }
            }

            CoachSectionHeader(text = stringResource(Res.string.log_session_notes))
            CoachTextField(
                value = notes,
                onValueChange = onNotes,
                label = stringResource(Res.string.log_session_notes_label),
                modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp),
                singleLine = false,
            )

            CoachButton(
                text = stringResource(Res.string.log_session_save_workout),
                onClick = onSave,
                modifier = Modifier.fillMaxWidth().height(56.dp).navigationBarsPadding(),
                isLoading = isLogging,
                enabled = canSave,
            )
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun ManualExerciseCard(
    index: Int,
    exercise: LocalDraftExercise,
    onUpdate: (LocalDraftExercise) -> Unit,
    onRemove: (() -> Unit)?,
    onAddVideo: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(Res.string.exercise_label, index + 1),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = onAddVideo,
                        modifier = Modifier.size(Sizes.touchTarget),
                        colors = IconButtonDefaults.iconButtonColors(
                            containerColor = if (exercise.videoUrl != null) {
                                MaterialTheme.colorScheme.onBackground
                            } else {
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)
                            },
                            contentColor = if (exercise.videoUrl != null) {
                                MaterialTheme.colorScheme.background
                            } else {
                                MaterialTheme.colorScheme.onBackground
                            },
                        ),
                    ) {
                        Icon(
                            imageVector = if (exercise.videoUrl != null) Icons.Default.Check else Icons.Default.Videocam,
                            contentDescription = stringResource(Res.string.add_video_cd),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                    if (onRemove != null) {
                        IconButton(onClick = onRemove, modifier = Modifier.size(Sizes.touchTarget)) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = stringResource(Res.string.remove_cd),
                                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
            }

            CoachTextField(
                value = exercise.name,
                onValueChange = { onUpdate(exercise.copy(name = it)) },
                label = stringResource(Res.string.log_session_exercise_name),
            )

            exercise.sets.forEachIndexed { setIndex, set ->
                SetInputRow(
                    setDraft = set.toSetDraft(),
                    onActualReps = { reps ->
                        onUpdate(exercise.updateSet(setIndex) { it.copy(actualReps = reps) })
                    },
                    onActualWeight = { weight ->
                        onUpdate(exercise.updateSet(setIndex) { it.copy(actualWeightKg = weight) })
                    },
                    onRpe = { rpe ->
                        onUpdate(exercise.updateSet(setIndex) { it.copy(rpe = rpe) })
                    },
                    onCompleted = {
                        onUpdate(exercise.updateSet(setIndex) { it.copy(completed = !it.completed) })
                    },
                )
            }

            TextButton(onClick = { onUpdate(exercise.addSet()) }) {
                Text(stringResource(Res.string.add_set))
            }
        }
    }
}

private data class LocalDraftExercise(
    val name: String = "",
    val sets: List<LocalDraftSet> = listOf(LocalDraftSet(sortOrder = 1)),
    val videoUrl: String? = null,
)

private data class LocalDraftSet(
    val sortOrder: Int,
    val actualReps: Int? = null,
    val actualWeightKg: Float? = null,
    val rpe: Int? = null,
    val completed: Boolean = false,
)

private fun LocalDraftExercise.updateSet(
    setIndex: Int,
    transform: (LocalDraftSet) -> LocalDraftSet,
): LocalDraftExercise = copy(
    sets = sets.mapIndexed { index, set -> if (index == setIndex) transform(set) else set },
)

private fun LocalDraftExercise.addSet(): LocalDraftExercise {
    val last = sets.lastOrNull()
    return copy(
        sets = sets + LocalDraftSet(
            sortOrder = (last?.sortOrder ?: 0) + 1,
            actualReps = last?.actualReps,
            actualWeightKg = last?.actualWeightKg,
        ),
    )
}

private fun LocalDraftSet.toSetDraft(): SetDraft = SetDraft(
    sortOrder = sortOrder,
    targetReps = null,
    actualReps = actualReps,
    targetWeightKg = null,
    actualWeightKg = actualWeightKg,
    rpe = rpe,
    targetRestSeconds = null,
    actualRestSeconds = null,
    completed = completed,
)

private fun List<LocalDraftExercise>.toExerciseLogs(): List<ExerciseLog> =
    filter { it.name.isNotBlank() }
        .map { exercise ->
            ExerciseLog(
                id = "",
                workoutLogId = "",
                exerciseName = exercise.name,
                notes = null,
                videoUrl = exercise.videoUrl,
                sets = exercise.sets.filter { it.completed }.map { set ->
                    SetLog(
                        id = "",
                        exerciseLogId = "",
                        sortOrder = set.sortOrder,
                        targetReps = null,
                        actualReps = set.actualReps,
                        targetWeightKg = null,
                        actualWeightKg = set.actualWeightKg,
                        rpe = set.rpe,
                        targetRestSeconds = null,
                        actualRestSeconds = null,
                        completed = true,
                    )
                },
            )
        }
        .filter { it.sets.isNotEmpty() }

@Preview
@Composable
private fun LogWorkoutScreenPreviewEmpty() {
    LogWorkoutContent(
        workoutName = "",
        onWorkoutName = {},
        durationMinutes = "",
        onDurationMinutes = {},
        notes = "",
        onNotes = {},
        exercises = listOf(LocalDraftExercise()),
        onExercises = {},
        onAddVideo = {},
        onBackClick = {},
        isLogging = false,
        onSave = {},
    )
}

@Preview
@Composable
private fun LogWorkoutScreenPreviewTwoExercises() {
    LogWorkoutContent(
        workoutName = "Upper Body",
        onWorkoutName = {},
        durationMinutes = "45",
        onDurationMinutes = {},
        notes = "Good session.",
        onNotes = {},
        exercises = listOf(
            LocalDraftExercise(
                name = "Bench Press",
                sets = listOf(
                    LocalDraftSet(1, 10, 60f, 7, true),
                    LocalDraftSet(2, 8, 62.5f, 8, true),
                ),
            ),
            LocalDraftExercise(
                name = "Rows",
                sets = listOf(LocalDraftSet(1, 12, 40f, 6, true)),
            ),
        ),
        onExercises = {},
        onAddVideo = {},
        onBackClick = {},
        isLogging = false,
        onSave = {},
    )
}
