package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.ProgressDashboardState
import com.coachfoska.app.presentation.workout.ProgressDashboardViewModel
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.progress_kg_this_week
import coachfoska.composeapp.generated.resources.progress_recent_prs_title
import coachfoska.composeapp.generated.resources.progress_week_streak
import coachfoska.composeapp.generated.resources.progress_your_progress
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.app.ui.workout.components.MuscleDistributionChart
import com.coachfoska.app.ui.workout.components.WeeklyCalendarStrip
import com.coachfoska.app.ui.workout.components.WorkoutsPerWeekChart
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ProgressDashboardRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: ProgressDashboardViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ProgressDashboardScreen(
        state = state,
        onBackClick = onBackClick,
        onTimePeriodSelected = viewModel::onTimePeriodSelected,
    )
}

@Composable
fun ProgressDashboardScreen(
    state: ProgressDashboardState,
    onBackClick: () -> Unit,
    onTimePeriodSelected: (TimePeriod) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        DsTopBar(title = stringResource(Res.string.progress_your_progress), onBackClick = onBackClick, backContentDescription = stringResource(Res.string.back_cd))

        if (state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Weekly calendar
            WeeklyCalendarStrip(completions = state.weeklyCompletions)

            // Stat cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = formatWeightKg(state.totalVolumeThisWeek),
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                            color = DsTheme.colors.actionPrimary,
                        )
                        Text(stringResource(Res.string.progress_kg_this_week), style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
                    }
                }
                Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "🔥 ${state.currentStreak}",
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        )
                        Text(stringResource(Res.string.progress_week_streak), style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
                    }
                }
            }

            // Muscle distribution
            if (state.muscleDistribution.isNotEmpty()) {
                MuscleDistributionChart(entries = state.muscleDistribution)
            }

            // Recent PRs
            if (state.recentPRs.isNotEmpty()) {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = stringResource(Res.string.progress_recent_prs_title),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onTertiaryContainer,
                        )
                        Spacer(Modifier.height(8.dp))
                        state.recentPRs.forEach { pr ->
                            Text(
                                text = "${pr.exerciseName} ${pr.value}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onTertiaryContainer,
                            )
                        }
                    }
                }
            }

            // Workouts per week chart
            if (state.workoutsPerWeek.isNotEmpty()) {
                Column {
                    // Time period selector
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        TimePeriod.entries.forEach { period ->
                            FilterChip(
                                selected = period == state.selectedTimePeriod,
                                onClick = { onTimePeriodSelected(period) },
                                label = {
                                    Text(when (period) {
                                        TimePeriod.ONE_MONTH -> "1M"
                                        TimePeriod.THREE_MONTHS -> "3M"
                                        TimePeriod.SIX_MONTHS -> "6M"
                                        TimePeriod.ONE_YEAR -> "1Y"
                                        TimePeriod.ALL -> "All"
                                    })
                                },
                            )
                        }
                    }
                    WorkoutsPerWeekChart(data = state.workoutsPerWeek)
                }
            }
        }
    }
}
