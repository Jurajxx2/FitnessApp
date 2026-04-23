package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.img_nutrition_history
import coachfoska.composeapp.generated.resources.img_nutrition_plan
import coachfoska.composeapp.generated.resources.img_nutrition_recipes
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.HubImageCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun NutritionHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    NutritionHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onRecipesClick = onRecipesClick
    )
}

@Composable
fun NutritionHubScreen(
    state: NutritionState,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit
) {
    val planSubtitle = when {
        state.isLoading -> "Loading..."
        state.mealPlan == null -> "No meal plan assigned"
        else -> {
            val mealCount = state.mealPlan.meals.size
            val totalKcal = state.mealPlan.meals.sumOf { it.totalCalories.toDouble() }.toInt()
            "$mealCount meals · $totalKcal kcal"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Text(
            text = "NUTRITION",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )
        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            HubImageCard(
                imageRes = Res.drawable.img_nutrition_plan,
                eyebrow = "Plan",
                title = "Daily Meal Plan",
                subtitle = planSubtitle,
                badge = "TODAY",
                onClick = onPlanClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = "Log",
                    title = "History",
                    subtitle = "Past meals",
                    onClick = onHistoryClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_recipes,
                    eyebrow = "Browse",
                    title = "Recipes",
                    subtitle = "Meal ideas",
                    onClick = onRecipesClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
            }
        }
    }
}
