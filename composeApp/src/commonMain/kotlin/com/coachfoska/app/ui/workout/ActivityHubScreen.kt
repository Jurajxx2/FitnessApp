package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.activity_hub_browse_workouts
import coachfoska.composeapp.generated.resources.activity_hub_compliance_format
import coachfoska.composeapp.generated.resources.activity_hub_done_meta_format
import coachfoska.composeapp.generated.resources.activity_hub_exercises
import coachfoska.composeapp.generated.resources.activity_hub_no_workouts
import coachfoska.composeapp.generated.resources.activity_hub_next_workout_format
import coachfoska.composeapp.generated.resources.activity_hub_progress_analytics
import coachfoska.composeapp.generated.resources.activity_hub_this_week
import coachfoska.composeapp.generated.resources.activity_hub_today_done
import coachfoska.composeapp.generated.resources.activity_hub_today_preview_more
import coachfoska.composeapp.generated.resources.activity_hub_today_rest_desc
import coachfoska.composeapp.generated.resources.activity_hub_today_rest_title
import coachfoska.composeapp.generated.resources.activity_hub_todays_workout
import coachfoska.composeapp.generated.resources.activity_hub_title
import coachfoska.composeapp.generated.resources.activity_hub_view_history
import coachfoska.composeapp.generated.resources.activity_hub_workout_meta_format
import coachfoska.composeapp.generated.resources.activity_hub_workout_history
import coachfoska.composeapp.generated.resources.activity_hub_workout_plan
import coachfoska.composeapp.generated.resources.activity_hub_workouts
import coachfoska.composeapp.generated.resources.common_see_all
import coachfoska.composeapp.generated.resources.log_activity_title
import coachfoska.composeapp.generated.resources.session_resume_action
import coachfoska.composeapp.generated.resources.session_resume_title
import coachfoska.composeapp.generated.resources.start_workout
import coachfoska.composeapp.generated.resources.weekly_activity_rest_day
import coachfoska.composeapp.generated.resources.weekly_activity_volume_label
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.usecase.workout.buildWeeklyActivity
import com.coachfoska.app.domain.usecase.workout.deriveCategoryLabel
import com.coachfoska.app.domain.usecase.workout.deriveTodayVolumeKg
import com.coachfoska.app.domain.usecase.workout.deriveWeeklyCompliance
import com.coachfoska.app.domain.usecase.workout.formatVolumeKg
import com.coachfoska.app.domain.usecase.workout.matchesWorkout
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsSectionHeader
import com.coachfoska.app.ui.workout.components.AssignedWorkoutCard
import com.coachfoska.app.ui.workout.components.ExercisePreviewCard
import com.coachfoska.app.ui.workout.components.QuickLinkRow
import com.coachfoska.app.ui.workout.components.WeeklyActivityGrid
import com.coachfoska.app.ui.components.localizedName
import kotlinx.datetime.TimeZone
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun ActivityHubRoute(
    userId: String,
    onStartWorkout: (workoutId: String) -> Unit,
    onResumeSession: (workoutId: String, logId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onExerciseClick: (exerciseId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
    exerciseViewModel: ExerciseViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val exerciseState by exerciseViewModel.state.collectAsStateWithLifecycle()

    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        viewModel.onIntent(WorkoutIntent.LoadInProgressSession)
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    ActivityHubScreen(
        state = state,
        exercises = exerciseState.exercises,
        onStartWorkout = onStartWorkout,
        onResumeSession = onResumeSession,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onLibraryClick = onLibraryClick,
        onProgressClick = onProgressClick,
        onWorkoutClick = onWorkoutClick,
        onExerciseClick = onExerciseClick,
        onLogGeneralActivityClick = onLogGeneralActivityClick,
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    exercises: List<Exercise>,
    onStartWorkout: (workoutId: String) -> Unit,
    onResumeSession: (workoutId: String, logId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onExerciseClick: (exerciseId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    val today = todayDate()
    val todayWorkout = remember(state.workouts, today) {
        state.workouts.firstOrNull { it.dayOfWeek?.index == today.dayOfWeek.ordinal }
    }
    val zone = TimeZone.currentSystemDefault()
    val weeklyDays = remember(state.workouts, state.workoutHistory, today, zone) {
        buildWeeklyActivity(state.workouts, state.workoutHistory, today, zone)
    }
    val todayActivity = remember(weeklyDays, today) {
        weeklyDays.firstOrNull { it.dayOfWeek.index == today.dayOfWeek.ordinal }
    }
    val completedTodayLog = remember(todayActivity, todayWorkout) {
        val log = todayActivity?.completedLog
        when {
            log == null -> null
            todayWorkout == null -> log
            log.matchesWorkout(todayWorkout) -> log
            else -> null
        }
    }
    val compliance = remember(weeklyDays) { deriveWeeklyCompliance(weeklyDays) }
    val todayVolumeKg = remember(todayWorkout, state.workoutHistory) {
        deriveTodayVolumeKg(todayWorkout, state.workoutHistory)
    }
    val nextWorkout = remember(state.workouts, today) {
        findNextWorkout(state.workouts, today.dayOfWeek.ordinal)
    }
    val isCoachedMode = state.workouts.isNotEmpty()

    Surface(modifier = Modifier.fillMaxSize(), color = DsTheme.colors.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            BrandHeader()

            if (state.isLoading && state.workouts.isEmpty()) {
                DsLoadingBox(modifier = Modifier.fillMaxWidth().height(200.dp))
            } else {
                state.inProgressSession?.let { session ->
                    ResumeSessionBanner(session = session, onResumeSession = onResumeSession)
                }

                if (isCoachedMode) {
                    WeeklyPlanSection(
                        days = weeklyDays,
                        completed = compliance.completed,
                        assigned = compliance.assigned,
                        onDayClick = { day ->
                            when {
                                day.plannedWorkout != null -> onWorkoutClick(day.plannedWorkout.id)
                                day.completedLog != null -> onHistoryClick()
                            }
                        },
                    )
                    TodayWorkoutHero(
                        todayWorkout = todayWorkout,
                        completedLog = completedTodayLog,
                        nextWorkout = nextWorkout,
                        volumeKg = todayVolumeKg,
                        coachedMode = true,
                        onStartWorkout = onStartWorkout,
                        onBrowse = onPlanClick,
                        onHistoryClick = onHistoryClick,
                        onLogGeneralActivityClick = onLogGeneralActivityClick,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        DsSectionHeader(
                            title = stringResource(Res.string.activity_hub_workout_plan),
                            actionLabel = stringResource(Res.string.common_see_all),
                            onAction = onPlanClick,
                        )
                        WorkoutCardRow(workouts = state.workouts, onWorkoutClick = onWorkoutClick)
                    }
                } else {
                    TodayWorkoutHero(
                        todayWorkout = null,
                        completedLog = completedTodayLog,
                        nextWorkout = null,
                        volumeKg = null,
                        coachedMode = false,
                        onStartWorkout = onStartWorkout,
                        onBrowse = onPlanClick,
                        onHistoryClick = onHistoryClick,
                        onLogGeneralActivityClick = onLogGeneralActivityClick,
                    )
                }

                if (!isCoachedMode && state.allWorkouts.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        DsSectionHeader(
                            title = stringResource(Res.string.activity_hub_workouts),
                            actionLabel = stringResource(Res.string.common_see_all),
                            onAction = onPlanClick,
                        )
                        WorkoutCardRow(workouts = state.allWorkouts, onWorkoutClick = onWorkoutClick)
                    }
                }

                if (exercises.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        DsSectionHeader(
                            title = stringResource(Res.string.activity_hub_exercises),
                            actionLabel = stringResource(Res.string.common_see_all),
                            onAction = onLibraryClick,
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(end = 16.dp),
                        ) {
                            items(exercises, key = { it.id }) { exercise ->
                                ExercisePreviewCard(
                                    exercise = exercise,
                                    onClick = { onExerciseClick(exercise.id) },
                                )
                            }
                        }
                    }
                }

                Column {
                    QuickLinkRow(icon = Icons.Filled.History, label = stringResource(Res.string.activity_hub_workout_history), onClick = onHistoryClick)
                    QuickLinkRow(icon = Icons.AutoMirrored.Filled.TrendingUp, label = stringResource(Res.string.activity_hub_progress_analytics), onClick = onProgressClick)
                    QuickLinkRow(icon = Icons.Filled.Add, label = stringResource(Res.string.log_activity_title), onClick = onLogGeneralActivityClick)
                }

                state.error?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.error)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ResumeSessionBanner(
    session: WorkoutLog,
    onResumeSession: (workoutId: String, logId: String) -> Unit,
) {
    Surface(
        color = DsTheme.colors.surfaceElevated,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(Res.string.session_resume_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = DsTheme.colors.textPrimary,
                )
                Text(
                    text = session.workoutName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textSecondary,
                )
            }
            Button(
                enabled = session.workoutId != null,
                onClick = { session.workoutId?.let { onResumeSession(it, session.id) } },
            ) {
                Text(stringResource(Res.string.session_resume_action))
            }
        }
    }
}

@Composable
private fun BrandHeader() {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(
            text = stringResource(Res.string.activity_hub_title),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.ExtraBold,
            color = DsTheme.colors.textPrimary,
        )
    }
}

@Composable
private fun WeeklyPlanSection(
    days: List<WeekDayActivity>,
    completed: Int,
    assigned: Int,
    onDayClick: (WeekDayActivity) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(Res.string.activity_hub_this_week),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = DsTheme.colors.textPrimary,
            )
            if (assigned > 0) {
                Text(
                    text = stringResource(Res.string.activity_hub_compliance_format, completed, assigned),
                    style = MaterialTheme.typography.labelMedium,
                    color = DsTheme.colors.textSecondary,
                )
            }
        }
        WeeklyActivityGrid(days = days, onDayClick = onDayClick)
    }
}

@Composable
private fun TodayWorkoutHero(
    todayWorkout: Workout?,
    completedLog: WorkoutLog?,
    nextWorkout: Workout?,
    volumeKg: Double?,
    coachedMode: Boolean,
    onStartWorkout: (String) -> Unit,
    onBrowse: () -> Unit,
    onHistoryClick: () -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    val completed = completedLog != null
    val icon = when {
        completed -> Icons.Filled.CheckCircle
        todayWorkout != null -> Icons.Filled.FitnessCenter
        coachedMode -> Icons.Filled.Hotel
        else -> Icons.Filled.FitnessCenter
    }
    val eyebrow = when {
        completed -> stringResource(Res.string.activity_hub_today_done)
        todayWorkout != null -> stringResource(Res.string.activity_hub_todays_workout)
        coachedMode -> stringResource(Res.string.weekly_activity_rest_day)
        else -> stringResource(Res.string.activity_hub_workouts)
    }
    val title = when {
        completedLog != null -> completedLog.workoutName
        todayWorkout != null -> todayWorkout.name
        coachedMode -> stringResource(Res.string.activity_hub_today_rest_title)
        else -> stringResource(Res.string.activity_hub_browse_workouts)
    }
    val primaryLabel = when {
        completed -> stringResource(Res.string.activity_hub_view_history)
        todayWorkout != null -> stringResource(Res.string.start_workout)
        coachedMode -> stringResource(Res.string.log_activity_title)
        else -> stringResource(Res.string.activity_hub_browse_workouts)
    }
    val primaryIcon = when {
        completed -> Icons.Filled.History
        todayWorkout != null -> Icons.Filled.PlayArrow
        coachedMode -> Icons.Filled.Add
        else -> Icons.Filled.PlayArrow
    }
    val primaryAction = when {
        completed -> onHistoryClick
        todayWorkout != null -> ({ onStartWorkout(todayWorkout.id) })
        coachedMode -> onLogGeneralActivityClick
        else -> onBrowse
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = DsTheme.colors.surface,
        shape = SquareShape,
        border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = DsTheme.colors.actionPrimary, modifier = Modifier.size(20.dp))
                    Text(
                        text = eyebrow,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = DsTheme.colors.textSecondary,
                    )
                }
                if (todayWorkout != null && !completed) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Schedule, contentDescription = null, tint = DsTheme.colors.textSecondary, modifier = Modifier.size(16.dp))
                        Text(
                            text = stringResource(
                                Res.string.activity_hub_workout_meta_format,
                                todayWorkout.durationMinutes,
                                todayWorkout.exercises.size,
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            color = DsTheme.colors.textSecondary,
                        )
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = title.uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = DsTheme.colors.textPrimary,
                )
                TodayHeroBody(
                    todayWorkout = todayWorkout,
                    completedLog = completedLog,
                    nextWorkout = nextWorkout,
                    volumeKg = volumeKg,
                    coachedMode = coachedMode,
                )
            }

            Button(
                onClick = primaryAction,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = SquareShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = DsTheme.colors.actionPrimary,
                    contentColor = DsTheme.colors.onActionPrimary,
                ),
            ) {
                Icon(primaryIcon, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(primaryLabel, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun TodayHeroBody(
    todayWorkout: Workout?,
    completedLog: WorkoutLog?,
    nextWorkout: Workout?,
    volumeKg: Double?,
    coachedMode: Boolean,
) {
    when {
        completedLog != null -> {
            val setsDone = completedLog.exerciseLogs.sumOf { exercise -> exercise.sets.count { it.completed } }
            Text(
                text = stringResource(
                    Res.string.activity_hub_done_meta_format,
                    completedLog.durationMinutes,
                    setsDone,
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textSecondary,
            )
            if (volumeKg != null) {
                Text(
                    text = "${stringResource(Res.string.weekly_activity_volume_label)} ${formatVolumeKg(volumeKg)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = DsTheme.colors.textSecondary,
                )
            }
        }
        todayWorkout != null -> {
            val preview = todayWorkout.exercises.sortedBy { it.sortOrder }.take(4)
            if (preview.isNotEmpty()) {
                Text(
                    text = preview.joinToString(" · ") { it.name },
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textSecondary,
                )
                val remaining = todayWorkout.exercises.size - preview.size
                if (remaining > 0) {
                    Text(
                        text = stringResource(Res.string.activity_hub_today_preview_more, remaining),
                        style = MaterialTheme.typography.bodySmall,
                        color = DsTheme.colors.textSecondary,
                    )
                }
            }
        }
        coachedMode -> {
            val workout = nextWorkout
            val day = workout?.dayOfWeek
            val nextText = if (workout != null && day != null) {
                stringResource(
                    Res.string.activity_hub_next_workout_format,
                    day.localizedName(),
                    workout.name,
                )
            } else {
                stringResource(Res.string.activity_hub_today_rest_desc)
            }
            Text(
                text = nextText,
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textSecondary,
            )
        }
        else -> {
            Text(
                text = stringResource(Res.string.activity_hub_no_workouts),
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textSecondary,
            )
        }
    }
}

@Composable
private fun WorkoutCardRow(workouts: List<Workout>, onWorkoutClick: (String) -> Unit) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(end = 16.dp),
    ) {
        items(workouts, key = { it.id }) { workout ->
            AssignedWorkoutCard(
                workout = workout,
                categoryLabel = deriveCategoryLabel(workout),
                onClick = { onWorkoutClick(workout.id) },
            )
        }
    }
}

private fun findNextWorkout(workouts: List<Workout>, todayIndex: Int): Workout? {
    return workouts
        .mapNotNull { workout ->
            val dayIndex = workout.dayOfWeek?.index ?: return@mapNotNull null
            val daysAway = (dayIndex - todayIndex + 7) % 7
            workout to if (daysAway == 0) 7 else daysAway
        }
        .minByOrNull { (_, daysAway) -> daysAway }
        ?.first
}

private fun previewExercise(name: String, muscle: String) = WorkoutExercise(
    id = name, workoutId = "1", name = name, muscleGroup = muscle,
    sets = 4, reps = "10", restSeconds = 90, tips = null,
)

@Preview
@Composable
private fun ActivityHubScreenPreview() {
    val workouts = listOf(
        Workout(
            id = "1", name = "Upper Body Strength", dayOfWeek = DayOfWeek.MONDAY, durationMinutes = 45,
            exercises = listOf(previewExercise("Bench", "Chest"), previewExercise("Row", "Back")),
        ),
        Workout(
            id = "2", name = "Leg Day", dayOfWeek = DayOfWeek.FRIDAY, durationMinutes = 60,
            exercises = listOf(previewExercise("Squat", "Legs")),
        ),
    )
    ActivityHubScreen(
        state = WorkoutState(workouts = workouts, allWorkouts = workouts),
        exercises = emptyList(),
        onStartWorkout = {}, onResumeSession = { _, _ -> }, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {},
        onExerciseClick = {}, onLogGeneralActivityClick = {},
    )
}

@Preview
@Composable
private fun ActivityHubScreenRestDayPreview() {
    ActivityHubScreen(
        state = WorkoutState(workouts = emptyList()),
        exercises = emptyList(),
        onStartWorkout = {}, onResumeSession = { _, _ -> }, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {},
        onExerciseClick = {}, onLogGeneralActivityClick = {},
    )
}
