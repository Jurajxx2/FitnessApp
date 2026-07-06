package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.common_cancel
import coachfoska.composeapp.generated.resources.common_delete
import coachfoska.composeapp.generated.resources.common_edit
import coachfoska.composeapp.generated.resources.plan_coach_badge
import coachfoska.composeapp.generated.resources.plan_create_action
import coachfoska.composeapp.generated.resources.plan_create_first_message
import coachfoska.composeapp.generated.resources.plan_create_first_title
import coachfoska.composeapp.generated.resources.plan_delete_confirm
import coachfoska.composeapp.generated.resources.plan_exercise_count
import coachfoska.composeapp.generated.resources.plan_last_performed
import coachfoska.composeapp.generated.resources.plan_log_session
import coachfoska.composeapp.generated.resources.plan_mine_badge
import coachfoska.composeapp.generated.resources.plan_never_performed
import coachfoska.composeapp.generated.resources.plan_title
import coachfoska.composeapp.generated.resources.workout_card_duration_format
import com.coachfoska.app.core.util.toDisplayDate
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutSource
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.theme.Spacing
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.designsystem.components.DsEmptyState
import com.coachfoska.designsystem.components.DsChip
import com.coachfoska.designsystem.components.DsSectionHeader
import com.coachfoska.app.ui.components.localizedName
import kotlinx.datetime.Instant
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutPlanRoute(
    userId: String,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onCreateWorkout: () -> Unit,
    onEditWorkout: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    WorkoutPlanScreen(
        state = state,
        onWorkoutClick = onWorkoutClick,
        onLogWorkoutClick = onLogWorkoutClick,
        onCreateWorkout = onCreateWorkout,
        onEditWorkout = onEditWorkout,
        onDeleteWorkout = { viewModel.onIntent(WorkoutIntent.DeleteWorkout(it)) },
        onBackClick = onBackClick
    )
}

@Composable
fun WorkoutPlanScreen(
    state: WorkoutState,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onCreateWorkout: () -> Unit,
    onEditWorkout: (String) -> Unit,
    onDeleteWorkout: (String) -> Unit,
    onBackClick: () -> Unit
) {
    var showDeleteDialogFor by remember { mutableStateOf<String?>(null) }

    val coachPlans = state.workouts.filter { it.source == WorkoutSource.COACH }
    val myPlans = state.workouts.filter { it.source == WorkoutSource.USER }
    val allEmpty = coachPlans.isEmpty() && myPlans.isEmpty()

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        DsTopBar(
            title = stringResource(Res.string.plan_title),
            onBackClick = onBackClick,
            backContentDescription = stringResource(Res.string.back_cd),
            actions = {
                IconButton(onClick = onCreateWorkout) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = stringResource(Res.string.plan_create_action)
                    )
                }
            }
        )

        if (state.isLoading) {
            DsLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = Spacing.xl, vertical = Spacing.xl),
                verticalArrangement = Arrangement.spacedBy(Spacing.lg)
            ) {
                if (allEmpty) {
                    item {
                        DsEmptyState(
                            icon = Icons.Default.FitnessCenter,
                            title = stringResource(Res.string.plan_create_first_title),
                            message = stringResource(Res.string.plan_create_first_message),
                            actionLabel = stringResource(Res.string.plan_create_action),
                            onAction = onCreateWorkout,
                        )
                    }
                } else {
                    if (coachPlans.isNotEmpty()) {
                        item {
                            DsSectionHeader(title = stringResource(Res.string.plan_coach_badge))
                        }
                        items(coachPlans) { workout ->
                            WorkoutPlanCard(
                                workout = workout,
                                lastPerformed = state.lastPerformedByWorkoutId[workout.id],
                                onClick = { onWorkoutClick(workout.id) },
                                onEdit = null,
                                onDelete = null
                            )
                        }
                    }
                    if (myPlans.isNotEmpty()) {
                        item {
                            DsSectionHeader(
                                title = stringResource(Res.string.plan_mine_badge),
                                modifier = if (coachPlans.isNotEmpty()) Modifier.padding(top = Spacing.lg) else Modifier
                            )
                        }
                        items(myPlans) { workout ->
                            WorkoutPlanCard(
                                workout = workout,
                                lastPerformed = state.lastPerformedByWorkoutId[workout.id],
                                onClick = { onWorkoutClick(workout.id) },
                                onEdit = { onEditWorkout(workout.id) },
                                onDelete = { showDeleteDialogFor = workout.id }
                            )
                        }
                    }
                }
            }

            DsButton(
                text = stringResource(Res.string.plan_log_session),
                onClick = onLogWorkoutClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.xl, vertical = Spacing.xl)
            )
        }
    }

    if (showDeleteDialogFor != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialogFor = null },
            text = { Text(stringResource(Res.string.plan_delete_confirm)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteDialogFor?.let { onDeleteWorkout(it) }
                        showDeleteDialogFor = null
                    }
                ) {
                    Text(stringResource(Res.string.common_delete))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialogFor = null }) {
                    Text(stringResource(Res.string.common_cancel))
                }
            }
        )
    }
}

@Composable
private fun WorkoutPlanCard(
    workout: Workout,
    lastPerformed: Instant?,
    onClick: () -> Unit,
    onEdit: (() -> Unit)?,
    onDelete: (() -> Unit)?
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val isUserPlan = onEdit != null || onDelete != null

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.xl),
            verticalArrangement = Arrangement.spacedBy(Spacing.md)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Source badge chip
                DsChip(
                    selected = workout.source == WorkoutSource.COACH,
                    label = if (workout.source == WorkoutSource.COACH)
                        stringResource(Res.string.plan_coach_badge)
                    else
                        stringResource(Res.string.plan_mine_badge),
                    onClick = {}
                )

                // Overflow menu for user plans
                if (isUserPlan) {
                    Box {
                        IconButton(onClick = { menuExpanded = true }) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                        }
                        DropdownMenu(
                            expanded = menuExpanded,
                            onDismissRequest = { menuExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(stringResource(Res.string.common_edit)) },
                                onClick = {
                                    menuExpanded = false
                                    onEdit?.invoke()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text(stringResource(Res.string.common_delete)) },
                                onClick = {
                                    menuExpanded = false
                                    onDelete?.invoke()
                                }
                            )
                        }
                    }
                }
            }

            workout.dayOfWeek?.let {
                Text(
                    text = it.localizedName().uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
            }

            Text(
                text = workout.name,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(Res.string.plan_exercise_count, workout.exercises.size),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                if (workout.durationMinutes > 0) {
                    Box(
                        modifier = Modifier
                            .size(3.dp)
                            .background(
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                                RoundedCornerShape(50)
                            )
                    )
                    Text(
                        text = stringResource(Res.string.workout_card_duration_format, workout.durationMinutes),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                    )
                }
            }

            // Last-performed line
            val lastPerformedText = if (lastPerformed != null) {
                stringResource(Res.string.plan_last_performed, lastPerformed.toDisplayDate())
            } else {
                stringResource(Res.string.plan_never_performed)
            }
            Text(
                text = lastPerformedText,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
            )
        }
    }
}
