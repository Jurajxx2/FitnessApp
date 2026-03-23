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
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "NUTRITION",
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.headlineMedium,
                letterSpacing = 2.sp
            )
            IconButton(onClick = onMealHistoryClick) {
                Icon(
                    Icons.Default.History,
                    contentDescription = "History",
                    tint = MaterialTheme.colorScheme.onBackground
                )
            }
        }

        if (state.isLoading) {
            CoachLoadingBox()
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                state.mealPlan?.let { plan ->
                    item {
                        Text(
                            text = plan.name,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            fontSize = 13.sp
                        )
                    }
                    items(plan.meals.sortedBy { it.sortOrder }) { meal ->
                        MealCard(meal = meal, onClick = { onMealClick(meal.id) })
                    }
                } ?: item {
                    Text(
                        text = "No meal plan assigned yet.\nYour coach will set one up for you.",
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        fontSize = 14.sp,
                        lineHeight = 22.sp
                    )
                }
            }

            CoachButton(
                text = "RECORD MEAL",
                onClick = onRecordMealClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp)
            )
        }
    }
}

@Composable
private fun MealCard(meal: Meal, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = meal.name,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
            meal.timeOfDay?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    fontSize = 13.sp
                )
            }
        }
        Text(
            text = "${meal.totalCalories.toInt()} kcal · ${meal.totalProtein.toInt()}g protein",
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 13.sp
        )
    }
}
