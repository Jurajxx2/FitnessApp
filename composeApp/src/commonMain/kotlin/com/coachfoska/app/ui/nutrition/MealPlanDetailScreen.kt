package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealPlanDetailRoute(
    userId: String,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MealPlanDetailScreen(
        state = state,
        onMealClick = onMealClick,
        onRecordMealClick = onRecordMealClick,
        onBackClick = onBackClick
    )
}

@Composable
fun MealPlanDetailScreen(
    state: NutritionState,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "MEAL PLAN", onBackClick = onBackClick)

        if (state.isLoading) {
            CoachLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
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
                        MealPlanDetailCard(meal = meal, onClick = { onMealClick(meal.id) })
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
private fun MealPlanDetailCard(meal: Meal, onClick: () -> Unit) {
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
                Text(
                    text = "${meal.totalCalories.toInt()} KCAL",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .size(3.dp)
                        .background(
                            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                            RoundedCornerShape(50)
                        )
                )
                Text(
                    text = "${meal.totalProtein.toInt()}G PROTEIN",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
            }
        }
    }
}
