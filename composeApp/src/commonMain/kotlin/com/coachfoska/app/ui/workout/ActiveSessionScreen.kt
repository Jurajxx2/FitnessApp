package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.presentation.workout.ActiveSessionIntent
import com.coachfoska.app.presentation.workout.ActiveSessionState
import com.coachfoska.app.presentation.workout.ActiveSessionViewModel
import com.coachfoska.app.ui.workout.components.*
import kotlinx.coroutines.delay
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActiveSessionRoute(
    workoutId: String,
    userId: String,
    onBackClick: () -> Unit,
    onWorkoutComplete: (logId: String) -> Unit,
    onExerciseDetailClick: (exerciseId: String) -> Unit = {},
    viewModel: ActiveSessionViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        viewModel.onIntent(ActiveSessionIntent.InitSession(workoutId))
    }

    LaunchedEffect(state.submittedLogId) {
        state.submittedLogId?.let { logId -> onWorkoutComplete(logId) }
    }

    var elapsedSeconds by remember { mutableStateOf(0L) }
    LaunchedEffect(state.sessionStartTime) {
        if (state.sessionStartTime > 0) {
            while (true) {
                elapsedSeconds = (currentInstant().toEpochMilliseconds() - state.sessionStartTime) / 1000
                delay(1000)
            }
        }
    }

    var showDiscardDialog by remember { mutableStateOf(false) }

    if (showDiscardDialog) {
        AlertDialog(
            onDismissRequest = { showDiscardDialog = false },
            title = { Text("Discard Workout?") },
            text = { Text("Your progress will be lost.") },
            confirmButton = {
                TextButton(onClick = { showDiscardDialog = false; onBackClick() }) {
                    Text("Discard", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardDialog = false }) { Text("Cancel") }
            },
        )
    }

    ActiveSessionScreen(
        state = state,
        elapsedSeconds = elapsedSeconds,
        onIntent = viewModel::onIntent,
        onBackClick = { showDiscardDialog = true },
        onFinishClick = { notes -> viewModel.onIntent(ActiveSessionIntent.SubmitSession(notes)) },
        onExerciseDetailClick = onExerciseDetailClick,
    )
}

@Composable
fun ActiveSessionScreen(
    state: ActiveSessionState,
    elapsedSeconds: Long,
    onIntent: (ActiveSessionIntent) -> Unit,
    onBackClick: () -> Unit,
    onFinishClick: (String?) -> Unit,
    onExerciseDetailClick: (exerciseId: String) -> Unit = {},
) {
    val draft = state.sessionDraft
    var notes by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        SessionHeaderBar(
            draft = draft,
            elapsedSeconds = elapsedSeconds,
            onBackClick = onBackClick,
            onFinishClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
            onDiscardClick = onBackClick,
        )

        if (draft == null || state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        ExerciseTabStrip(
            exercises = draft.exercises,
            currentIndex = state.currentExerciseIndex,
            onExerciseSelected = { onIntent(ActiveSessionIntent.SwitchExercise(it)) },
        )

        HorizontalDivider()

        val currentExercise = draft.exercises.getOrNull(state.currentExerciseIndex) ?: return@Column
        val previousSets = state.previousData[currentExercise.exerciseName].orEmpty()

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = currentExercise.exerciseName,
                style = MaterialTheme.typography.titleMedium,
            )
            val subtitle = buildString {
                currentExercise.muscleGroup?.let { append("$it · ") }
                append("${currentExercise.initialSetsGoal} × ${currentExercise.initialRepsGoal}")
                currentExercise.sets.firstOrNull()?.targetRestSeconds?.let { append(" · ${it}s rest") }
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            currentExercise.tips?.let { tips ->
                Text(
                    text = tips,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            PRBanner(pr = state.activePRBanner)

            RestTimerBar(
                timerState = state.restTimer,
                onAdjust = { onIntent(ActiveSessionIntent.AdjustRestTimer(it)) },
                onSkip = { onIntent(ActiveSessionIntent.SkipRestTimer) },
            )

            SetTableHeader()
            HorizontalDivider()

            val firstIncompleteIndex = currentExercise.sets.indexOfFirst { !it.completed }
            currentExercise.sets.forEachIndexed { setIndex, setDraft ->
                val previousSet = previousSets.getOrNull(setIndex)
                val isNext = setIndex == firstIncompleteIndex

                SetRow(
                    setDraft = setDraft,
                    previousSetLog = previousSet,
                    isNextSet = isNext,
                    isWarmup = false,
                    onWeightChange = { weight ->
                        onIntent(ActiveSessionIntent.UpdateSetActual(
                            state.currentExerciseIndex, setIndex, setDraft.actualReps, weight,
                        ))
                    },
                    onRepsChange = { reps ->
                        onIntent(ActiveSessionIntent.UpdateSetActual(
                            state.currentExerciseIndex, setIndex, reps, setDraft.actualWeightKg,
                        ))
                    },
                    onCompleted = {
                        onIntent(ActiveSessionIntent.MarkSetComplete(
                            state.currentExerciseIndex, setIndex, !setDraft.completed,
                        ))
                    },
                )
            }

            TextButton(onClick = { onIntent(ActiveSessionIntent.AddExtraSet(state.currentExerciseIndex)) }) {
                Text("+ ADD SET")
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes (optional)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )

            currentExercise.exerciseId?.let { exId ->
                Surface(
                    onClick = { onExerciseDetailClick(exId) },
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = "🏋️ Tap to view form guide →",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            if (state.currentExerciseIndex == draft.exercises.lastIndex) {
                Button(
                    onClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.isSubmitting,
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    } else {
                        Text("FINISH WORKOUT")
                    }
                }
            }
        }
    }
}
