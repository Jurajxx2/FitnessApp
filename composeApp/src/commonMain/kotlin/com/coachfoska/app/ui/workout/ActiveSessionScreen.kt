package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.editor_add_exercise
import coachfoska.composeapp.generated.resources.finish_workout
import coachfoska.composeapp.generated.resources.notes_optional
import coachfoska.composeapp.generated.resources.common_keep_working
import coachfoska.composeapp.generated.resources.session_discard
import coachfoska.composeapp.generated.resources.session_discard_confirm
import coachfoska.composeapp.generated.resources.session_save_degraded
import coachfoska.composeapp.generated.resources.session_sets_progress
import coachfoska.composeapp.generated.resources.substitute_applied
import coachfoska.composeapp.generated.resources.substitute_title
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.presentation.workout.ActiveSessionIntent
import com.coachfoska.app.presentation.workout.ActiveSessionState
import com.coachfoska.app.presentation.workout.ActiveSessionViewModel
import com.coachfoska.app.presentation.workout.SessionDraft
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsButtonVariant
import com.coachfoska.app.ui.workout.components.*
import com.coachfoska.designsystem.theme.LocalReduceMotion
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
                    Text(stringResource(Res.string.session_discard), color = DsTheme.colors.error)
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
    var showAddExerciseSheet by remember { mutableStateOf(false) }
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

    // Auto-advance: when the ViewModel moves to the next incomplete exercise
    // (e.g. after all sets of one are done), scroll its card into view.
    val listState = rememberLazyListState()
    LaunchedEffect(state.currentExerciseIndex) {
        val exercises = state.sessionDraft?.exercises ?: return@LaunchedEffect
        if (state.currentExerciseIndex in exercises.indices) {
            listState.animateScrollToItem(state.currentExerciseIndex)
        }
    }

    Scaffold(
        // The root Scaffold in App.kt already applies system-bar insets to this screen; consuming
        // them again here previously left a dead band above the toolbar. Consume nothing.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                SessionHeaderBar(
                    draft = draft,
                    elapsedSeconds = elapsedSeconds,
                    onBackClick = onBackClick,
                    onFinishClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
                    onDiscardClick = onBackClick,
                    onWorkoutNameChange = { onIntent(ActiveSessionIntent.RenameSession(it)) },
                )
                if (state.sessionSaveDegraded) {
                    Text(
                        text = stringResource(Res.string.session_save_degraded),
                        style = MaterialTheme.typography.bodySmall,
                        color = DsTheme.colors.error,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                if (draft != null) {
                    SessionProgressBar(draft)
                }
            }
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (draft == null || state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                return@Box
            }

            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = 10.dp,
                    end = 10.dp,
                    top = 12.dp,
                    bottom = if (state.restTimer.isActive) 96.dp else 24.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                itemsIndexed(
                    items = draft.exercises,
                    key = { index, exercise -> "ex-$index-${exercise.exerciseName}" },
                ) { index, exercise ->
                    ExerciseLogCard(
                        exercise = exercise,
                        exerciseIndex = index,
                        previousSets = state.previousData[exercise.exerciseName].orEmpty(),
                        prBanner = state.activePRBanner?.takeIf { it.exerciseName == exercise.exerciseName },
                        onIntent = onIntent,
                        onSwapClick = { substituteIndex = index },
                        onExerciseDetailClick = onExerciseDetailClick,
                        canMoveUp = index > 0,
                        canMoveDown = index < draft.exercises.lastIndex,
                    )
                }

                item(key = "session-footer") {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        DsButton(
                            text = stringResource(Res.string.editor_add_exercise),
                            onClick = { showAddExerciseSheet = true },
                            modifier = Modifier.fillMaxWidth(),
                            variant = DsButtonVariant.Outlined,
                        )
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text(stringResource(Res.string.notes_optional)) },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                        )
                        DsButton(
                            text = stringResource(Res.string.finish_workout),
                            onClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !state.isSubmitting,
                            isLoading = state.isSubmitting,
                        )
                    }
                }
            }

            RestTimerBar(
                timerState = state.restTimer,
                onAdjust = { onIntent(ActiveSessionIntent.AdjustRestTimer(it)) },
                onSkip = { onIntent(ActiveSessionIntent.SkipRestTimer) },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp),
            )
        }

        // Substitute exercise sheet
        if (substituteIndex != null) {
            val exIndex = substituteIndex!!
            val exercise = draft?.exercises?.getOrNull(exIndex)
            SubstituteExerciseSheet(
                currentExerciseId = exercise?.exerciseId,
                title = stringResource(Res.string.substitute_title),
                sheetState = substituteSheetState,
                onExerciseSelected = { replacement ->
                    onIntent(ActiveSessionIntent.SubstituteExercise(exIndex, replacement))
                    substituteIndex = null
                },
                onDismiss = { substituteIndex = null },
            )
        }

        if (showAddExerciseSheet) {
            SubstituteExerciseSheet(
                currentExerciseId = null,
                title = stringResource(Res.string.editor_add_exercise),
                sheetState = substituteSheetState,
                onExerciseSelected = { exercise ->
                    onIntent(ActiveSessionIntent.AddExercise(exercise))
                    showAddExerciseSheet = false
                },
                onDismiss = { showAddExerciseSheet = false },
            )
        }
    }
}

/** Slim session-wide progress: how many sets are done across all exercises. */
@Composable
private fun SessionProgressBar(draft: SessionDraft, modifier: Modifier = Modifier) {
    val totalSets = draft.exercises.sumOf { it.sets.size }
    val doneSets = draft.exercises.sumOf { exercise -> exercise.sets.count { it.completed } }
    val target = if (totalSets > 0) doneSets.toFloat() / totalSets else 0f
    val progress = if (LocalReduceMotion.current) target
    else animateFloatAsState(targetValue = target, label = "session-progress").value

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = stringResource(Res.string.session_sets_progress, doneSets, totalSets),
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textSecondary,
        )
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp)),
            trackColor = DsTheme.colors.surfaceElevated,
        )
    }
}
