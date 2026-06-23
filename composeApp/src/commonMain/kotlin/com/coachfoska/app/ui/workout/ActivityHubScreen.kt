package com.coachfoska.app.ui.workout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.usecase.workout.buildWeeklyActivity
import com.coachfoska.app.domain.usecase.workout.deriveCategoryLabel
import com.coachfoska.app.domain.usecase.workout.deriveTodayVolumeKg
import com.coachfoska.app.domain.usecase.workout.formatVolumeKg
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.workout.components.AssignedWorkoutCard
import com.coachfoska.app.ui.workout.components.QuickLinkRow
import com.coachfoska.app.ui.workout.components.WeeklyActivityGrid
import kotlinx.datetime.TimeZone
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun ActivityHubRoute(
    userId: String,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    ActivityHubScreen(
        state = state,
        onStartWorkout = onStartWorkout,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onLibraryClick = onLibraryClick,
        onProgressClick = onProgressClick,
        onWorkoutClick = onWorkoutClick,
        onLogGeneralActivityClick = onLogGeneralActivityClick,
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    val today = todayDate()
    val zone = TimeZone.currentSystemDefault()
    val todayWorkout = state.workouts.firstOrNull { it.dayOfWeek?.index == today.dayOfWeek.ordinal }
    val weeklyDays = buildWeeklyActivity(state.workouts, state.workoutHistory, today, zone)
    val volumeKg = deriveTodayVolumeKg(todayWorkout, state.workoutHistory)

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
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
                CoachLoadingBox(modifier = Modifier.fillMaxWidth().height(200.dp))
            } else {
                StartWorkoutButton(todayWorkout = todayWorkout, onStartWorkout = onStartWorkout, onBrowse = onPlanClick)

                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionLabel("WEEKLY ACTIVITY")
                    WeeklyActivityGrid(days = weeklyDays)
                    DaySummaryBar(todayWorkout = todayWorkout, volumeKg = volumeKg)
                }

                if (state.workouts.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            SectionLabel("ASSIGNED WORKOUTS")
                            Text(
                                text = "SCROLL →",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                letterSpacing = 1.sp,
                            )
                        }
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(end = 16.dp),
                        ) {
                            items(state.workouts, key = { it.id }) { workout ->
                                AssignedWorkoutCard(
                                    workout = workout,
                                    categoryLabel = deriveCategoryLabel(workout),
                                    onClick = { onWorkoutClick(workout.id) },
                                )
                            }
                        }
                    }
                } else {
                    Text(
                        text = "No workouts assigned yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Column {
                    QuickLinkRow(icon = Icons.Filled.MenuBook, label = "EXERCISE LIBRARY", onClick = onLibraryClick)
                    QuickLinkRow(icon = Icons.Filled.History, label = "WORKOUT HISTORY", onClick = onHistoryClick)
                    QuickLinkRow(icon = Icons.Filled.TrendingUp, label = "PROGRESS ANALYTICS", onClick = onProgressClick)
                    QuickLinkRow(icon = Icons.Filled.Add, label = "LOG ACTIVITY", onClick = onLogGeneralActivityClick)
                }

                state.error?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BrandHeader() {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(
            text = "COACH FOSKA",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 2.sp,
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onBackground,
        letterSpacing = 1.5.sp,
    )
}

@Composable
private fun StartWorkoutButton(
    todayWorkout: Workout?,
    onStartWorkout: (String) -> Unit,
    onBrowse: () -> Unit,
) {
    Button(
        onClick = { if (todayWorkout != null) onStartWorkout(todayWorkout.id) else onBrowse() },
        modifier = Modifier.fillMaxWidth().height(56.dp),
        shape = SquareShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            text = if (todayWorkout != null) "START WORKOUT" else "BROWSE WORKOUTS",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
private fun DaySummaryBar(todayWorkout: Workout?, volumeKg: Double?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), SquareShape)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (todayWorkout != null) "TODAY'S FOCUS" else "REST DAY",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp,
            )
            Text(
                text = (todayWorkout?.name ?: "Recovery").uppercase(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
        if (todayWorkout != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                SummaryMetric("DURATION", "${todayWorkout.durationMinutes}m")
                SummaryMetric("EXERCISES", todayWorkout.exercises.size.toString())
                if (volumeKg != null) {
                    SummaryMetric("VOLUME", formatVolumeKg(volumeKg))
                }
            }
        }
    }
}

@Composable
private fun SummaryMetric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.End) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 1.sp)
        Text(value, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground)
    }
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
        state = WorkoutState(workouts = workouts),
        onStartWorkout = {}, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {}, onLogGeneralActivityClick = {},
    )
}

@Preview
@Composable
private fun ActivityHubScreenRestDayPreview() {
    ActivityHubScreen(
        state = WorkoutState(workouts = emptyList()),
        onStartWorkout = {}, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {}, onLogGeneralActivityClick = {},
    )
}
