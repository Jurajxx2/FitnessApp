package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealPlanRoute(
    userId: String,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onMealHistoryClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MealPlanScreen(
        state = state,
        onMealClick = onMealClick,
        onRecordMealClick = onRecordMealClick,
        onMealHistoryClick = onMealHistoryClick
    )
}

@Composable
fun MealPlanScreen(
    state: NutritionState,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onMealHistoryClick: () -> Unit
) {
    if (state.isLoading) {
        CoachLoadingBox()
    } else {
        Column(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "NUTRITION",
                            style = MaterialTheme.typography.displayMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        IconButton(onClick = onMealHistoryClick) {
                            Icon(
                                Icons.Default.History,
                                contentDescription = "History",
                                tint = MaterialTheme.colorScheme.onBackground
                            )
                        }
                    }
                }

                item {
                    Text(
                        text = "DAILY MEAL PLAN",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 1.5.sp
                    )
                }

                state.mealPlan?.let { plan ->
                    items(plan.meals.sortedBy { it.sortOrder }) { meal ->
                        MealCard(meal = meal, onClick = { onMealClick(meal.id) })
                    }
                } ?: item {
                    Text(
                        text = "No meal plan assigned yet.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                    )
                }
            }

            CoachButton(
                text = "RECORD MEAL",
                onClick = onRecordMealClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 24.dp)
            )
        }
    }
}

@Composable
private fun MealCard(meal: Meal, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = meal.name,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onBackground
                )
                meal.timeOfDay?.let {
                    Text(
                        text = it.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 0.5.sp
                    )
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                MacroChip(value = "${meal.totalCalories.toInt()} KCAL")
                Box(modifier = Modifier.size(3.dp).background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)))
                MacroChip(value = "${meal.totalProtein.toInt()}G PROTEIN")
            }
        }
    }
}

@Composable
private fun MacroChip(value: String) {
    Text(
        text = value,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
    )
}
