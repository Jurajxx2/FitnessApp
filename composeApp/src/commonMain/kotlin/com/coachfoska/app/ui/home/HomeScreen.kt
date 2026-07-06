package com.coachfoska.app.ui.home

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.clickable
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.usecase.workout.buildWeeklyActivity
import com.coachfoska.app.domain.usecase.workout.deriveTodayVolumeKg
import com.coachfoska.app.presentation.home.HomeIntent
import com.coachfoska.app.presentation.home.HomeState
import com.coachfoska.app.presentation.home.HomeViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsEmptyState
import com.coachfoska.designsystem.components.DsMetricCard
import com.coachfoska.designsystem.components.DsMetricCardSkeleton
import com.coachfoska.app.ui.workout.components.WeeklyActivitySection
import kotlinx.datetime.TimeZone
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun HomeRoute(
    userId: String,
    onChatClick: () -> Unit = {},
    onWaterClick: () -> Unit = {},
    onWorkoutClick: (String) -> Unit = {},
    onStartWorkout: (String) -> Unit = {},
    onLogMealClick: () -> Unit = {},
    onGoToActivity: () -> Unit = {},
    viewModel: HomeViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onChatClick = {
            viewModel.onIntent(HomeIntent.MarkCoachMessageRead)
            onChatClick()
        },
        onWaterClick = onWaterClick,
        onWorkoutClick = onWorkoutClick,
        onStartWorkout = onStartWorkout,
        onLogMealClick = onLogMealClick,
        onGoToActivity = onGoToActivity,
    )
}

@Composable
fun HomeScreen(
    state: HomeState,
    onIntent: (HomeIntent) -> Unit,
    onChatClick: () -> Unit = {},
    onWaterClick: () -> Unit = {},
    onWorkoutClick: (String) -> Unit = {},
    onStartWorkout: (String) -> Unit = {},
    onLogMealClick: () -> Unit = {},
    onGoToActivity: () -> Unit = {},
) {
    var selectedDay by remember { mutableStateOf<WeekDayActivity?>(null) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            // Header with notification bell
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(Res.string.welcome_back),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = (state.user?.fullName?.split(" ")?.firstOrNull()
                            ?: stringResource(Res.string.default_athlete_name)).uppercase(),
                        style = MaterialTheme.typography.displayMedium,
                        color = MaterialTheme.colorScheme.onBackground,
                        letterSpacing = (-0.5).sp
                    )
                }
                NotificationBell(
                    hasUnread = state.hasUnreadCoachMessage,
                    onClick = onChatClick,
                )
            }

            // Metrics row (or skeleton while loading, or first-run guidance)
            if (state.isLoading) {
                Row(horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.md)) {
                    DsMetricCardSkeleton(Modifier.weight(1f))
                    DsMetricCardSkeleton(Modifier.weight(1f))
                    DsMetricCardSkeleton(Modifier.weight(1f))
                }
            } else if (state.isFirstRun) {
                DsEmptyState(
                    icon = Icons.Default.FitnessCenter,
                    title = stringResource(Res.string.home_first_run_title),
                    message = stringResource(Res.string.home_first_run_message),
                    actionLabel = stringResource(Res.string.home_first_run_action),
                    onAction = onGoToActivity,
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.md)) {
                        DsMetricCard(
                            value = state.weekWorkoutsDone.toString(),
                            label = stringResource(Res.string.home_metric_week_workouts),
                            modifier = Modifier.weight(1f),
                        )
                        DsMetricCard(
                            value = state.currentWeightKg?.let { formatWeightKg(it) } ?: "--",
                            label = stringResource(Res.string.home_metric_weight),
                            delta = state.weightDeltaKg?.let { delta ->
                                (if (delta > 0) "+" else "") + formatWeightKg(delta)
                            },
                            // Losing weight reads as positive for most fitness goals
                            deltaPositive = state.weightDeltaKg?.let { it <= 0f },
                            animateValue = false,
                            modifier = Modifier.weight(1f),
                        )
                        DsMetricCard(
                            value = state.streakWeeks.toString(),
                            label = stringResource(Res.string.home_metric_streak),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (state.metricsError) {
                        TextButton(onClick = { onIntent(HomeIntent.RetryMetrics) }) {
                            Text(stringResource(Res.string.home_metrics_retry))
                        }
                    }
                }
            }

            if (!state.isLoading && !state.isFirstRun) {
                // Weekly Activity
                run {
                    val today = todayDate()
                    val zone = TimeZone.currentSystemDefault()
                    val weeklyDays = remember(state.workouts, state.workoutHistory, today, zone) {
                        buildWeeklyActivity(state.workouts, state.workoutHistory, today, zone)
                    }
                    val volumeKg = remember(state.todayWorkout, state.workoutHistory) {
                        deriveTodayVolumeKg(state.todayWorkout, state.workoutHistory)
                    }
                    WeeklyActivitySection(
                        days = weeklyDays,
                        todayWorkout = state.todayWorkout,
                        volumeKg = volumeKg,
                        onTodayClick = state.todayWorkout?.let { w -> { onWorkoutClick(w.id) } },
                        onDayClick = { selectedDay = it },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                // Nutrition Summary
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = stringResource(Res.string.daily_nutrition),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                        letterSpacing = 1.5.sp
                    )

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            state.nutritionSummary?.let { nutrition ->
                                MacroRow(nutrition, state.macroTargets)
                            } ?: Text(
                                text = stringResource(Res.string.start_logging_meals),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                            )
                            WaterProgressRow(
                                consumedMl = state.waterConsumedMl,
                                goalMl = state.waterGoalMl,
                                onClick = onWaterClick,
                                onQuickAdd = { onIntent(HomeIntent.QuickAddWater) }
                            )
                            TextButton(
                                onClick = onLogMealClick,
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text(
                                    text = stringResource(Res.string.log_meal_button),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    letterSpacing = 1.sp
                                )
                            }
                        }
                    }
                }
            } else if (state.isLoading) {
                DsLoadingBox(modifier = Modifier.fillMaxWidth().height(200.dp))
            }

            state.error?.let {
                Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    selectedDay?.let { day ->
        DayDetailBottomSheet(day = day, onDismiss = { selectedDay = null })
    }
}

@Composable
private fun NotificationBell(hasUnread: Boolean, onClick: () -> Unit) {
    Box(contentAlignment = Alignment.TopEnd) {
        IconButton(onClick = onClick) {
            Icon(
                imageVector = Icons.Outlined.Notifications,
                contentDescription = stringResource(Res.string.home_notifications_cd),
                tint = MaterialTheme.colorScheme.onBackground,
            )
        }
        if (hasUnread) {
            Box(
                modifier = Modifier
                    .padding(top = 10.dp, end = 10.dp)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(Color.Red)
            )
        }
    }
}

@Composable
private fun WaterProgressRow(consumedMl: Int, goalMl: Int, onClick: () -> Unit, onQuickAdd: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        HorizontalDivider(
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
            modifier = Modifier.padding(bottom = 16.dp)
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "💧", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.width(6.dp))
            Text(
                text = stringResource(Res.string.home_water_label),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                letterSpacing = 1.sp,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = stringResource(Res.string.home_water_amount, consumedMl, goalMl),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = onQuickAdd, modifier = Modifier.size(DsTheme.sizes.touchTarget)) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = stringResource(Res.string.quick_add_water),
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        val fraction = if (goalMl > 0) (consumedMl.toFloat() / goalMl).coerceIn(0f, 1f) else 0f
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier
                .fillMaxWidth()
                .height(5.dp)
                .clip(RoundedCornerShape(50)),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    }
}

@Composable
private fun MacroRow(summary: DailyNutritionSummary, targets: MacroTargets?) {
    Row(modifier = Modifier.fillMaxWidth()) {
        MacroItem(stringResource(Res.string.macro_kcal), summary.calories, targets?.calories, modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_protein), summary.proteinG, targets?.proteinG, suffix = "g", modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_carbs), summary.carbsG, targets?.carbsG, suffix = "g", modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_fat), summary.fatG, targets?.fatG, suffix = "g", modifier = Modifier.weight(1f))
    }
}

@Composable
private fun MacroItem(
    label: String,
    value: Float,
    target: Float?,
    suffix: String = "",
    modifier: Modifier = Modifier
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier.padding(horizontal = 4.dp)) {
        Text(
            text = "${value.toInt()}$suffix",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        if (target != null && target > 0f) {
            Text(
                text = "/ ${target.toInt()}$suffix",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
            )
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (value / target).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(50)),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
    }
}
