package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.img_nutrition_history
import coachfoska.composeapp.generated.resources.img_nutrition_plan
import coachfoska.composeapp.generated.resources.img_nutrition_recipes
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.HubImageCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun NutritionHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onRecordMealClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onWaterClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    NutritionHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onRecordMealClick = onRecordMealClick,
        onHistoryClick = onHistoryClick,
        onRecipesClick = onRecipesClick,
        onWaterClick = onWaterClick
    )
}

@Composable
fun NutritionHubScreen(
    state: NutritionState,
    onPlanClick: () -> Unit,
    onRecordMealClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onWaterClick: () -> Unit
) {
    val todaysMeals = state.mealPlan?.meals
        ?.filter { it.dayOfWeek == null || it.dayOfWeek == state.selectedDayOfWeek }
        ?.sortedBy { it.sortOrder }
        ?: emptyList()
    val planSubtitle = when {
        state.isLoading -> "Loading..."
        state.mealPlan == null -> "No plan assigned"
        todaysMeals.isEmpty() -> "No meals today"
        else -> "${todaysMeals.size} meals · ${todaysMeals.totalCalories()} kcal"
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
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            TodayPlanPanel(
                isLoading = state.isLoading,
                planName = state.mealPlan?.name,
                meals = todaysMeals,
                onPlanClick = onPlanClick,
                onRecordMealClick = onRecordMealClick,
            )
            HubImageCard(
                imageRes = Res.drawable.img_nutrition_plan,
                eyebrow = "Plan",
                title = "Weekly Plan",
                subtitle = planSubtitle,
                badge = "TODAY",
                onClick = onPlanClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(132.dp)
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
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = "Track",
                    title = "Water",
                    subtitle = "Daily intake",
                    onClick = onWaterClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
            }
        }
    }
}

@Composable
private fun TodayPlanPanel(
    isLoading: Boolean,
    planName: String?,
    meals: List<Meal>,
    onPlanClick: () -> Unit,
    onRecordMealClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "TODAY",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.42f),
                        letterSpacing = 1.2.sp,
                    )
                    Text(
                        text = planName ?: if (isLoading) "Loading meal plan" else "No active plan",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Text(
                        text = if (meals.isEmpty()) "Log freely or ask your coach for an assigned plan."
                        else meals.joinToString("  +  ") { it.name },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.58f),
                        maxLines = 2,
                    )
                }
                AssistChip(
                    onClick = onPlanClick,
                    label = { Text("${meals.size} meals") },
                    enabled = meals.isNotEmpty(),
                )
            }

            if (meals.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    NutritionPill(label = "KCAL", value = meals.totalCalories().toString(), modifier = Modifier.weight(1f))
                    NutritionPill(label = "PRO", value = "${meals.totalProtein()}g", modifier = Modifier.weight(1f))
                    NutritionPill(label = "CARB", value = "${meals.totalCarbs()}g", modifier = Modifier.weight(1f))
                    NutritionPill(label = "FAT", value = "${meals.totalFat()}g", modifier = Modifier.weight(1f))
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    onClick = onRecordMealClick,
                    modifier = Modifier.weight(1f).height(46.dp),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.14f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onBackground),
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Log meal")
                }
                OutlinedButton(
                    onClick = onPlanClick,
                    modifier = Modifier.weight(1f).height(46.dp),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.primary),
                ) {
                    Icon(Icons.Default.RestaurantMenu, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Follow plan")
                }
            }
        }
    }
}

@Composable
private fun NutritionPill(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.04f),
    ) {
        Column(
            modifier = Modifier.padding(vertical = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(value, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.42f))
        }
    }
}

private fun List<Meal>.totalCalories() = sumOf { it.totalCalories.toDouble() }.toInt()
private fun List<Meal>.totalProtein() = sumOf { it.totalProtein.toDouble() }.toInt()
private fun List<Meal>.totalCarbs() = sumOf { it.totalCarbs.toDouble() }.toInt()
private fun List<Meal>.totalFat() = sumOf { it.totalFat.toDouble() }.toInt()
