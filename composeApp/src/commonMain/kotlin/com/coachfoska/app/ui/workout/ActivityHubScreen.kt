package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.*
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.workout.components.WeeklyCalendarStrip
import com.coachfoska.app.core.util.todayDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActivityHubRoute(
    userId: String,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onHistoryDetailClick: (logId: String) -> Unit = {},
    onLibraryClick: () -> Unit,
    onLogGeneralActivityClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    ActivityHubScreen(
        state = state,
        onStartWorkout = onStartWorkout,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onHistoryDetailClick = onHistoryDetailClick,
        onLibraryClick = onLibraryClick,
        onLogGeneralActivityClick = onLogGeneralActivityClick,
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onHistoryDetailClick: (logId: String) -> Unit = {},
    onLibraryClick: () -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        Text(
            text = "ACTIVITY",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(vertical = 24.dp),
        )

        val todayWorkout = findTodayWorkout(state.workouts)

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                if (todayWorkout != null) {
                    Text(
                        text = "🏋️ Today's Workout",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                    Text(
                        text = todayWorkout.name,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Spacer(Modifier.height(4.dp))

                    val details = buildString {
                        append("${todayWorkout.exercises.size} exercises")
                        if (todayWorkout.durationMinutes > 0) append(" · ~${todayWorkout.durationMinutes} min")
                        val muscles = todayWorkout.exercises.mapNotNull { it.muscleGroup }.distinct()
                        if (muscles.isNotEmpty()) append(" · ${muscles.joinToString(", ")}")
                    }
                    Text(
                        text = details,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )

                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { onStartWorkout(todayWorkout.id) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("▶ START WORKOUT")
                    }
                } else {
                    Text(
                        text = "Rest Day",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        text = "No workout scheduled for today. Browse the library or log an activity.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        val weeklyCompletions = buildWeeklyCompletions(state.workoutHistory)
        WeeklyCalendarStrip(completions = weeklyCompletions)

        Spacer(Modifier.height(20.dp))

        Text(
            text = "Recent Sessions",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(8.dp))

        val recentLogs = state.workoutHistory.take(3)
        if (recentLogs.isEmpty()) {
            Text(
                text = "No sessions logged yet.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            recentLogs.forEach { log ->
                Surface(
                    onClick = { onHistoryDetailClick(log.id) },
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = log.workoutName,
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "${log.durationMinutes} min",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            TextButton(onClick = onHistoryClick) {
                Text("See all history →")
            }
        }

        Spacer(Modifier.height(16.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedCard(
                onClick = onLibraryClick,
                modifier = Modifier.weight(1f).height(80.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text("📚", style = MaterialTheme.typography.titleMedium)
                    Text("Exercise Library", style = MaterialTheme.typography.labelMedium)
                }
            }
            OutlinedCard(
                onClick = onLogGeneralActivityClick,
                modifier = Modifier.weight(1f).height(80.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text("➕", style = MaterialTheme.typography.titleMedium)
                    Text("Log Activity", style = MaterialTheme.typography.labelMedium)
                }
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

private fun findTodayWorkout(workouts: List<Workout>): Workout? {
    val todayIndex = todayDate().dayOfWeek.ordinal
    return workouts.firstOrNull { it.dayOfWeek?.index == todayIndex }
}

private fun buildWeeklyCompletions(history: List<WorkoutLog>): List<DayCompletion> {
    val tz = TimeZone.currentSystemDefault()
    val today = todayDate()
    val todayDow = today.dayOfWeek.ordinal
    val completedDays = history
        .map { it.loggedAt.toLocalDateTime(tz).date }
        .filter { it.toEpochDays() >= today.toEpochDays() - todayDow && it.toEpochDays() <= today.toEpochDays() }
        .map { it.dayOfWeek.ordinal }
        .toSet()

    return DayOfWeek.entries.map { day ->
        val status = when {
            day.index in completedDays -> CompletionStatus.COMPLETED
            day.index == todayDow -> CompletionStatus.TODAY
            day.index < todayDow -> CompletionStatus.MISSED
            else -> CompletionStatus.UPCOMING
        }
        DayCompletion(dayOfWeek = day, status = status)
    }
}
