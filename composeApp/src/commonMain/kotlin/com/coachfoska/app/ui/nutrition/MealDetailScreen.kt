package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealDetailRoute(
    mealId: String,
    userId: String,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(mealId) {
        viewModel.onIntent(NutritionIntent.SelectMeal(mealId))
    }

    MealDetailScreen(state = state, onBackClick = onBackClick)
}

@Composable
fun MealDetailScreen(
    state: NutritionState,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = state.selectedMeal?.name ?: "Meal", onBackClick = onBackClick)

        state.selectedMeal?.let { meal ->
            LazyColumn(
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item { MacroRow(meal) }
                item { CoachSectionHeader(text = "FOODS") }
                items(meal.foods) { food ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = food.name,
                                color = MaterialTheme.colorScheme.onBackground,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "${food.amountGrams.toInt()}g",
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            text = "${food.calories.toInt()} kcal",
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MacroRow(meal: Meal) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        MacroItem("${meal.totalCalories.toInt()}", "kcal")
        MacroItem("${meal.totalProtein.toInt()}g", "protein")
        MacroItem("${meal.totalCarbs.toInt()}g", "carbs")
        MacroItem("${meal.totalFat.toInt()}g", "fat")
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 12.sp
        )
    }
}
