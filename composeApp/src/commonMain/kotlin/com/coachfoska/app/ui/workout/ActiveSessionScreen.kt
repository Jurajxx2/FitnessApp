package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
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
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.presentation.workout.ExerciseDraft
import com.coachfoska.app.presentation.workout.SessionDraft
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import androidx.compose.ui.tooling.preview.Preview
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActiveSessionRoute(
    workoutId: String,
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sessionStart = remember(workoutId) { currentInstant() }

    LaunchedEffect(workoutId) {
        viewModel.onIntent(WorkoutIntent.InitDraftFromWorkout(workoutId))
    }
    LaunchedEffect(state.workoutLoggedSuccess) {
        if (state.workoutLoggedSuccess) {
            viewModel.onIntent(WorkoutIntent.WorkoutLogged)
            onBackClick()
        }
    }

    ActiveSessionScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick,
        onSubmit = { notes ->
            val durationMinutes = ((currentInstant().toEpochMilliseconds() - sessionStart.toEpochMilliseconds()) / 60_000)
                .toInt()
                .coerceAtLeast(1)
            viewModel.onIntent(WorkoutIntent.SubmitActiveSession(durationMinutes, notes))
        },
    )
}

@Composable
fun ActiveSessionScreen(
    state: WorkoutState,
    onIntent: (WorkoutIntent) -> Unit,
    onBackClick: () -> Unit,
    onSubmit: (String?) -> Unit,
) {
    val draft = state.sessionDraft
    var notes by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(
            title = draft?.workoutName?.uppercase() ?: "WORKOUT",
            onBackClick = onBackClick,
        )

        if (draft == null || state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            itemsIndexed(draft.exercises) { exerciseIndex, exerciseDraft ->
                ExerciseDraftCard(
                    exerciseIndex = exerciseIndex,
                    draft = exerciseDraft,
                    onIntent = onIntent,
                )
            }
            item {
                CoachTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = "Notes (optional)",
                    singleLine = false,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp),
                )
            }
        }

        CoachButton(
            text = "FINISH WORKOUT",
            onClick = { onSubmit(notes.takeIf { it.isNotBlank() }) },
            isLoading = state.isLogging,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        )
    }
}

@Composable
private fun ExerciseDraftCard(
    exerciseIndex: Int,
    draft: ExerciseDraft,
    onIntent: (WorkoutIntent) -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = draft.exerciseName.uppercase(),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = "Target: ${draft.initialSetsGoal} x ${draft.initialRepsGoal}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))

            draft.sets.forEachIndexed { setIndex, set ->
                SetInputRow(
                    setDraft = set,
                    onActualReps = { reps ->
                        onIntent(
                            WorkoutIntent.UpdateSetActual(
                                exerciseIndex = exerciseIndex,
                                setIndex = setIndex,
                                reps = reps,
                                weight = set.actualWeightKg,
                                rpe = set.rpe,
                            )
                        )
                    },
                    onActualWeight = { weight ->
                        onIntent(
                            WorkoutIntent.UpdateSetActual(
                                exerciseIndex = exerciseIndex,
                                setIndex = setIndex,
                                reps = set.actualReps,
                                weight = weight,
                                rpe = set.rpe,
                            )
                        )
                    },
                    onRpe = { rpe ->
                        onIntent(
                            WorkoutIntent.UpdateSetActual(
                                exerciseIndex = exerciseIndex,
                                setIndex = setIndex,
                                reps = set.actualReps,
                                weight = set.actualWeightKg,
                                rpe = rpe,
                            )
                        )
                    },
                    onCompleted = {
                        onIntent(
                            WorkoutIntent.MarkSetComplete(
                                exerciseIndex = exerciseIndex,
                                setIndex = setIndex,
                                completed = !set.completed,
                            )
                        )
                    },
                )
            }

            TextButton(onClick = { onIntent(WorkoutIntent.AddExtraSet(exerciseIndex)) }) {
                Text("+ ADD SET")
            }
        }
    }
}

@Composable
internal fun SetInputRow(
    setDraft: SetDraft,
    onActualReps: (Int?) -> Unit,
    onActualWeight: (Float?) -> Unit,
    onRpe: (Int?) -> Unit,
    onCompleted: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "SET ${setDraft.sortOrder}",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.width(56.dp),
        )
        CoachTextField(
            value = setDraft.actualReps?.toString() ?: "",
            onValueChange = { onActualReps(it.toIntOrNull()) },
            label = "Reps",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.width(72.dp),
        )
        Spacer(Modifier.width(8.dp))
        CoachTextField(
            value = setDraft.actualWeightKg?.toString() ?: "",
            onValueChange = { onActualWeight(it.toFloatOrNull()) },
            label = "kg",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.width(80.dp),
        )
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Slider(
                value = (setDraft.rpe ?: 5).toFloat(),
                onValueChange = { onRpe(it.toInt()) },
                valueRange = 1f..10f,
                steps = 8,
            )
            Text(
                text = "RPE ${setDraft.rpe ?: "-"}",
                style = MaterialTheme.typography.labelSmall,
            )
        }
        Checkbox(checked = setDraft.completed, onCheckedChange = { onCompleted() })
    }
}

@Preview
@Composable
private fun ActiveSessionScreenPreviewEmpty() {
    val draft = previewSessionDraft(
        sets = (1..3).map {
            SetDraft(
                sortOrder = it,
                targetReps = 10,
                actualReps = null,
                targetWeightKg = null,
                actualWeightKg = null,
                rpe = null,
                targetRestSeconds = 60,
                actualRestSeconds = null,
                completed = false,
            )
        },
    )
    ActiveSessionScreen(
        state = WorkoutState(sessionDraft = draft),
        onIntent = {},
        onBackClick = {},
        onSubmit = {},
    )
}

@Preview
@Composable
private fun ActiveSessionScreenPreviewMidSession() {
    val draft = previewSessionDraft(
        sets = listOf(
            SetDraft(1, 10, 10, null, 60f, 7, 60, null, true),
            SetDraft(2, 10, 9, null, 60f, 8, 60, null, true),
            SetDraft(3, 10, null, null, 60f, null, 60, null, false),
        ),
    )
    ActiveSessionScreen(
        state = WorkoutState(sessionDraft = draft),
        onIntent = {},
        onBackClick = {},
        onSubmit = {},
    )
}

@Preview
@Composable
private fun ActiveSessionScreenPreviewAllCompleted() {
    val draft = previewSessionDraft(
        sets = (1..3).map {
            SetDraft(it, 10, 10, null, 60f, 7, 60, null, true)
        },
    )
    ActiveSessionScreen(
        state = WorkoutState(sessionDraft = draft),
        onIntent = {},
        onBackClick = {},
        onSubmit = {},
    )
}

@Preview
@Composable
private fun SetInputRowPreview() {
    SetInputRow(
        setDraft = SetDraft(
            sortOrder = 1,
            targetReps = 10,
            actualReps = 10,
            targetWeightKg = null,
            actualWeightKg = 60f,
            rpe = 7,
            targetRestSeconds = 60,
            actualRestSeconds = null,
            completed = true,
        ),
        onActualReps = {},
        onActualWeight = {},
        onRpe = {},
        onCompleted = {},
    )
}

private fun previewSessionDraft(sets: List<SetDraft>): SessionDraft {
    val workout = previewWorkout()
    return SessionDraft(
        workoutId = workout.id,
        workoutName = workout.name,
        startTime = 0L,
        exercises = listOf(
            ExerciseDraft(
                exerciseName = workout.exercises[0].name,
                initialSetsGoal = workout.exercises[0].sets,
                initialRepsGoal = workout.exercises[0].reps,
                sets = sets,
            )
        ),
    )
}

private fun previewWorkout() = Workout(
    id = "w-preview",
    name = "Push Day",
    dayOfWeek = DayOfWeek.MONDAY,
    durationMinutes = 60,
    exercises = listOf(
        WorkoutExercise(
            id = "we-1",
            workoutId = "w-preview",
            name = "Bench Press",
            muscleGroup = "Chest",
            sets = 3,
            reps = "10",
            restSeconds = 60,
            tips = null,
            sortOrder = 0,
        )
    ),
)
