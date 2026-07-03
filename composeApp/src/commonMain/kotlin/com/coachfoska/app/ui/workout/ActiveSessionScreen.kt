package com.coachfoska.app.ui.workout

import androidx.compose.animation.core.animateIntAsState
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
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.add_set
import coachfoska.composeapp.generated.resources.exercise_form_guide_cta
import coachfoska.composeapp.generated.resources.finish_workout
import coachfoska.composeapp.generated.resources.notes_optional
import coachfoska.composeapp.generated.resources.common_keep_working
import coachfoska.composeapp.generated.resources.session_discard
import coachfoska.composeapp.generated.resources.session_discard_confirm
import coachfoska.composeapp.generated.resources.session_save_degraded
import coachfoska.composeapp.generated.resources.session_volume_format
import coachfoska.composeapp.generated.resources.substitute_applied
import coachfoska.composeapp.generated.resources.substitute_cant_do
import com.coachfoska.app.core.util.LocalReduceMotion
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.presentation.workout.ActiveSessionIntent
import com.coachfoska.app.presentation.workout.ActiveSessionState
import com.coachfoska.app.presentation.workout.ActiveSessionViewModel
import com.coachfoska.app.theme.MetricSmall
import com.coachfoska.app.ui.workout.components.*
import kotlinx.coroutines.delay
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActiveSessionRoute(
    workoutId: String,
    resumeLogId: String? = null,
    userId: String,
    onBackClick: () -> Unit,
    onWorkoutComplete: (logId: String) -> Unit,
    onExerciseDetailClick: (exerciseId: String) -> Unit = {},
    viewModel: ActiveSessionViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId, resumeLogId) {
        viewModel.onIntent(ActiveSessionIntent.InitSession(workoutId, resumeLogId))
    }

    LaunchedEffect(state.submittedLogId) {
        state.submittedLogId?.let { logId -> onWorkoutComplete(logId) }
    }
    LaunchedEffect(state.sessionDiscarded) {
        if (state.sessionDiscarded) onBackClick()
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
            title = { Text(stringResource(Res.string.session_discard)) },
            text = { Text(stringResource(Res.string.session_discard_confirm)) },
            confirmButton = {
                TextButton(onClick = { showDiscardDialog = false; viewModel.onIntent(ActiveSessionIntent.DiscardSession) }) {
                    Text(stringResource(Res.string.session_discard), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardDialog = false }) { Text(stringResource(Res.string.common_keep_working)) }
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

@OptIn(ExperimentalMaterial3Api::class)
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

    // Substitute sheet state
    var substituteIndex by remember { mutableStateOf<Int?>(null) }
    val substituteSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Snackbar for substitution confirmation
    val snackbarHostState = remember { SnackbarHostState() }
    val appliedTemplate = stringResource(Res.string.substitute_applied)
    LaunchedEffect(state.lastSubstitution) {
        val sub = state.lastSubstitution ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(
            message = appliedTemplate
                .replace("%1\$s", sub.first)
                .replace("%2\$s", sub.second)
        )
        onIntent(ActiveSessionIntent.DismissSubstitution)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            SessionHeaderBar(
                draft = draft,
                elapsedSeconds = elapsedSeconds,
                onBackClick = onBackClick,
                onFinishClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
                onDiscardClick = onBackClick,
            )

            if (state.sessionSaveDegraded) {
                Text(
                    text = stringResource(Res.string.session_save_degraded),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }

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

            val volume = draft.exercises.sumOf { exercise ->
                exercise.sets
                    .filter { it.completed }
                    .sumOf { (((it.actualWeightKg ?: 0f) * (it.actualReps ?: 0)).toInt()) }
            }
            val animatedVolume by animateIntAsState(
                targetValue = volume,
                label = "session-volume",
            )
            val displayedVolume = if (LocalReduceMotion.current) volume else animatedVolume
            Text(
                text = stringResource(Res.string.session_volume_format, displayedVolume),
                style = MetricSmall,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

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

                // "Can't do this one" — opens the substitute sheet for the current exercise
                TextButton(
                    onClick = { substituteIndex = state.currentExerciseIndex },
                ) {
                    Text(
                        text = stringResource(Res.string.substitute_cant_do),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
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
                        onRetrySave = {
                            onIntent(ActiveSessionIntent.RetrySetSave(state.currentExerciseIndex, setIndex))
                        },
                    )
                }

                TextButton(onClick = { onIntent(ActiveSessionIntent.AddExtraSet(state.currentExerciseIndex)) }) {
                    Text(stringResource(Res.string.add_set))
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(stringResource(Res.string.notes_optional)) },
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
                            text = stringResource(Res.string.exercise_form_guide_cta),
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
                            Text(stringResource(Res.string.finish_workout))
                        }
                    }
                }
            }
        }

        // Substitute exercise sheet
        if (substituteIndex != null) {
            val exIndex = substituteIndex!!
            val exercise = draft?.exercises?.getOrNull(exIndex)
            SubstituteExerciseSheet(
                currentExerciseId = exercise?.exerciseId,
                sheetState = substituteSheetState,
                onExerciseSelected = { replacement ->
                    onIntent(ActiveSessionIntent.SubstituteExercise(exIndex, replacement))
                    substituteIndex = null
                },
                onDismiss = { substituteIndex = null },
            )
        }
    }
}
