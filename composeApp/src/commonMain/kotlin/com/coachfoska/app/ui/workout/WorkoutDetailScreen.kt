package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_edit
import coachfoska.composeapp.generated.resources.detail_coach_readonly
import coachfoska.composeapp.generated.resources.detail_start_workout
import coachfoska.composeapp.generated.resources.detail_title
import coachfoska.composeapp.generated.resources.plan_coach_badge
import coachfoska.composeapp.generated.resources.substitute_applied
import coachfoska.composeapp.generated.resources.substitute_swap_icon_cd
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutSource
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.theme.Spacing
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.designsystem.components.DsChip
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutDetailRoute(
    workoutId: String,
    userId: String,
    onBackClick: () -> Unit,
    onExerciseClick: (String) -> Unit,
    onStartWorkout: (String) -> Unit,
    onEditWorkout: (String) -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        viewModel.onIntent(WorkoutIntent.SelectWorkout(workoutId))
    }

    WorkoutDetailScreen(
        state = state,
        currentUserId = userId,
        onBackClick = onBackClick,
        onExerciseClick = onExerciseClick,
        onStartWorkout = onStartWorkout,
        onEditWorkout = onEditWorkout,
        onIntent = viewModel::onIntent,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutDetailScreen(
    state: WorkoutState,
    currentUserId: String,
    onBackClick: () -> Unit,
    onExerciseClick: (String) -> Unit,
    onStartWorkout: (String) -> Unit,
    onEditWorkout: (String) -> Unit,
    onIntent: (WorkoutIntent) -> Unit = {}
) {
    val workout = state.selectedWorkout
    val isCoachPlan = workout?.source == WorkoutSource.COACH
    val isOwned = workout != null && workout.ownerUserId == currentUserId
    val snackbarHostState = remember { SnackbarHostState() }
    val substituteSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var substituteIndex by remember { mutableStateOf<Int?>(null) }
    val appliedTemplate = stringResource(Res.string.substitute_applied)

    LaunchedEffect(state.lastPlanSubstitution) {
        val sub = state.lastPlanSubstitution ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(
            message = appliedTemplate
                .replace("%1\$s", sub.first)
                .replace("%2\$s", sub.second),
        )
        onIntent(WorkoutIntent.DismissPlanSubstitution)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            CoachTopBar(
                title = stringResource(Res.string.detail_title),
                onBackClick = onBackClick,
                actions = {
                    if (workout != null && isOwned) {
                        IconButton(onClick = { onEditWorkout(workout.id) }) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = stringResource(Res.string.common_edit)
                            )
                        }
                    }
                }
            )

            if (state.isLoading) {
                DsLoadingBox(Modifier.weight(1f))
            } else {
                workout?.let { w ->
                    Box(modifier = Modifier.weight(1f)) {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 100.dp)
                        ) {
                            item {
                                Column(modifier = Modifier.padding(Spacing.xl)) {
                                    // Coach badge for coach plans
                                    if (isCoachPlan) {
                                        DsChip(
                                            selected = true,
                                            label = stringResource(Res.string.plan_coach_badge),
                                            onClick = {},
                                            modifier = Modifier.padding(bottom = Spacing.sm)
                                        )
                                    }

                                    Text(
                                        text = w.name,
                                        style = MaterialTheme.typography.displayMedium,
                                        color = MaterialTheme.colorScheme.onBackground
                                    )

                                    if (w.notes != null) {
                                        Spacer(modifier = Modifier.height(Spacing.md))
                                        Text(
                                            text = w.notes,
                                            style = MaterialTheme.typography.bodyLarge,
                                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                        )
                                    }

                                    // Coach-readonly note
                                    if (isCoachPlan) {
                                        Spacer(modifier = Modifier.height(Spacing.md))
                                        Surface(
                                            color = MaterialTheme.colorScheme.surfaceVariant,
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = stringResource(Res.string.detail_coach_readonly),
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.padding(Spacing.md)
                                            )
                                        }
                                    }
                                }
                            }

                            itemsIndexed(w.exercises.sortedBy { it.sortOrder }) { index, exercise ->
                                ExerciseRow(
                                    index = index + 1,
                                    exercise = exercise,
                                    onClick = { exercise.exerciseId?.let { onExerciseClick(it) } },
                                    onSubstitute = { substituteIndex = index }
                                )
                                HorizontalDivider(
                                    modifier = Modifier.padding(horizontal = Spacing.xl),
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)
                                )
                            }
                        }

                        Surface(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(Spacing.xl),
                            color = MaterialTheme.colorScheme.background.copy(alpha = 0.9f)
                        ) {
                            DsButton(
                                text = stringResource(Res.string.detail_start_workout),
                                onClick = { onStartWorkout(w.id) }
                            )
                        }
                    }
                }
            }
        }

        if (substituteIndex != null) {
            val ordered = workout?.exercises?.sortedBy { it.sortOrder }.orEmpty()
            val exIndex = substituteIndex!!
            val exercise = ordered.getOrNull(exIndex)
            SubstituteExerciseSheet(
                currentExerciseId = exercise?.exerciseId,
                sheetState = substituteSheetState,
                onExerciseSelected = { replacement ->
                    onIntent(WorkoutIntent.SubstitutePlanExercise(exIndex, replacement))
                    substituteIndex = null
                },
                onDismiss = { substituteIndex = null },
            )
        }
    }
}

@Composable
private fun ExerciseRow(
    index: Int,
    exercise: WorkoutExercise,
    onClick: () -> Unit,
    onSubstitute: () -> Unit
) {
    Surface(
        onClick = onClick,
        color = MaterialTheme.colorScheme.background,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.xl, vertical = Spacing.lg + Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.lg + Spacing.sm)
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "$index",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = exercise.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
                exercise.muscleGroup?.let {
                    Text(
                        text = it.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 0.5.sp
                    )
                }
            }

            Surface(
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = "${exercise.sets} × ${exercise.reps}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(horizontal = Spacing.sm, vertical = Spacing.xs)
                )
            }

            // Substitute affordance — UI stub; logic wired in substitution task (Task 8)
            IconButton(
                onClick = onSubstitute,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.SwapHoriz,
                    contentDescription = stringResource(Res.string.substitute_swap_icon_cd),
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                )
            }
        }
    }
}
