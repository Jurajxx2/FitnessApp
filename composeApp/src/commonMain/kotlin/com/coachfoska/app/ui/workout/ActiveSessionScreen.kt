package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
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
import kotlinx.coroutines.launch
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
    var menuExpanded by remember { mutableStateOf(false) }
    val pagerState = rememberPagerState(pageCount = { draft?.exercises?.size ?: 0 })
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(
            title = draft?.workoutName?.uppercase() ?: "WORKOUT",
            onBackClick = onBackClick,
            actions = {
                Box {
                    IconButton(onClick = { menuExpanded = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More options")
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                    ) {
                        val exerciseCount = draft?.exercises?.size ?: 1
                        val isLastExercise = pagerState.currentPage == exerciseCount - 1
                        if (!isLastExercise) {
                            DropdownMenuItem(
                                text = { Text("Skip exercise") },
                                onClick = {
                                    menuExpanded = false
                                    scope.launch {
                                        pagerState.animateScrollToPage(pagerState.currentPage + 1)
                                    }
                                },
                            )
                        }
                        DropdownMenuItem(
                            text = { Text("Finish workout") },
                            onClick = {
                                menuExpanded = false
                                onSubmit(notes.takeIf { it.isNotBlank() })
                            },
                        )
                    }
                }
            },
        )

        if (draft == null || state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f),
        ) { pageIndex ->
            ExercisePage(
                exerciseIndex = pageIndex,
                draft = draft.exercises[pageIndex],
                isLastExercise = pageIndex == draft.exercises.lastIndex,
                notes = notes,
                onNotesChange = { notes = it },
                onIntent = onIntent,
            )
        }

        ExerciseDotIndicator(
            exercises = draft.exercises,
            currentPage = pagerState.currentPage,
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        )

        val isLastPage = pagerState.currentPage == draft.exercises.lastIndex
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (pagerState.currentPage > 0) {
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage - 1)
                        }
                    },
                ) {
                    Text("< PREV")
                }
            } else {
                Spacer(Modifier.width(1.dp))
            }
            if (isLastPage) {
                CoachButton(
                    text = "FINISH WORKOUT",
                    onClick = { onSubmit(notes.takeIf { it.isNotBlank() }) },
                    isLoading = state.isLogging,
                )
            } else {
                CoachButton(
                    text = "NEXT >",
                    onClick = {
                        scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun ExercisePage(
    exerciseIndex: Int,
    draft: ExerciseDraft,
    isLastExercise: Boolean,
    notes: String,
    onNotesChange: (String) -> Unit,
    onIntent: (WorkoutIntent) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (draft.videoUrl != null) {
            ExerciseAnimatedImage(
                startUrl = draft.videoUrl,
                endUrl = null,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)),
            )
        }

        draft.muscleGroup?.let { group ->
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.secondaryContainer,
            ) {
                Text(
                    text = group,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
        }

        Text(
            text = draft.exerciseName.uppercase(),
            style = MaterialTheme.typography.titleLarge,
        )

        Text(
            text = "${draft.initialSetsGoal} × ${draft.initialRepsGoal}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        draft.tips?.let { tips ->
            Text(
                text = tips,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        HorizontalDivider()

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

        if (isLastExercise) {
            CoachTextField(
                value = notes,
                onValueChange = onNotesChange,
                label = "Notes (optional)",
                singleLine = false,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp),
            )
        }
    }
}

@Composable
private fun ExerciseDotIndicator(
    exercises: List<ExerciseDraft>,
    currentPage: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        exercises.forEachIndexed { index, exercise ->
            val isCompleted = exercise.sets.all { it.completed }
            val isCurrent = index == currentPage
            val dotSize = if (isCurrent) 10.dp else 8.dp
            val color = when {
                isCompleted || isCurrent -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
            }
            Box(
                modifier = Modifier
                    .padding(horizontal = 3.dp)
                    .size(dotSize)
                    .background(color, CircleShape),
            )
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

// ── Previews ──────────────────────────────────────────────────────────────────

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
                muscleGroup = workout.exercises[0].muscleGroup,
                tips = workout.exercises[0].tips,
                videoUrl = workout.exercises[0].videoUrl,
                sets = sets,
            ),
            ExerciseDraft(
                exerciseName = "Incline Dumbbell Press",
                initialSetsGoal = 3,
                initialRepsGoal = "12",
                muscleGroup = "Chest",
                tips = "Control the descent.",
                sets = (1..3).map {
                    SetDraft(it, 12, null, null, null, null, 60, null, false)
                },
            ),
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
            tips = "Keep elbows at 45°.",
            videoUrl = null,
            sortOrder = 0,
        )
    ),
)
