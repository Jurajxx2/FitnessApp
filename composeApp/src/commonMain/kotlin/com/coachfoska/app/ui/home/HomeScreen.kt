package com.coachfoska.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.presentation.home.HomeIntent
import com.coachfoska.app.presentation.home.HomeState
import com.coachfoska.app.presentation.home.HomeViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachSectionHeader
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun HomeRoute(
    userId: String,
    viewModel: HomeViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(state = state, onIntent = viewModel::onIntent)
}

@Composable
fun HomeScreen(
    state: HomeState,
    onIntent: (HomeIntent) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Column {
            Text(
                text = "Good morning,",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                fontSize = 14.sp
            )
            Text(
                text = state.user?.fullName?.split(" ")?.firstOrNull() ?: "Athlete",
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.displayMedium
            )
        }

        if (state.isLoading) {
            CoachLoadingBox(modifier = Modifier.fillMaxWidth().height(120.dp))
        } else {
            state.todayWorkout?.let { workout ->
                HomeCard(title = "TODAY'S WORKOUT") { TodayWorkoutContent(workout) }
            } ?: HomeCard(title = "TODAY'S WORKOUT") {
                Text(
                    text = "Rest day — recovery is part of the plan.",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    fontSize = 14.sp
                )
            }

            HomeCard(title = "TODAY'S NUTRITION") {
                state.nutritionSummary?.let { NutritionSummaryContent(it) }
                    ?: Text(
                        text = "No meals logged today yet.",
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                        fontSize = 14.sp
                    )
            }
        }

        state.error?.let {
            Text(text = it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
    }
}

@Composable
private fun HomeCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CoachSectionHeader(text = title)
        content()
    }
}

@Composable
private fun TodayWorkoutContent(workout: Workout) {
    Text(
        text = workout.name,
        color = MaterialTheme.colorScheme.onBackground,
        style = MaterialTheme.typography.headlineSmall
    )
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        StatChip("${workout.exercises.size} exercises")
        StatChip("${workout.durationMinutes} min")
    }
    workout.dayOfWeek?.let {
        Text(
            text = it.displayName,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 13.sp
        )
    }
}

@Composable
private fun NutritionSummaryContent(summary: DailyNutritionSummary) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        MacroStat(value = "${summary.calories.toInt()}", unit = "kcal")
        MacroStat(value = "${summary.proteinG.toInt()}g", unit = "protein")
        MacroStat(value = "${summary.carbsG.toInt()}g", unit = "carbs")
        MacroStat(value = "${summary.fatG.toInt()}g", unit = "fat")
    }
}

@Composable
private fun StatChip(label: String) {
    Text(
        text = label,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
        fontSize = 13.sp,
        modifier = Modifier
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f),
                RoundedCornerShape(4.dp)
            )
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}

@Composable
private fun MacroStat(value: String, unit: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = unit,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 12.sp
        )
    }
}
