package com.coachfoska.app.ui.nutrition

import com.coachfoska.designsystem.theme.DsTheme
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
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.common_grams_format
import coachfoska.composeapp.generated.resources.log_this_meal
import coachfoska.composeapp.generated.resources.meal_detail_screen_title
import coachfoska.composeapp.generated.resources.meal_ingredients_section
import coachfoska.composeapp.generated.resources.meal_macro_label_carbs
import coachfoska.composeapp.generated.resources.meal_macro_label_fat
import coachfoska.composeapp.generated.resources.meal_macro_label_kcal
import coachfoska.composeapp.generated.resources.meal_macro_label_protein
import coachfoska.composeapp.generated.resources.meal_not_found
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealDetailRoute(
    mealId: String,
    userId: String,
    onBackClick: () -> Unit,
    onLogMeal: () -> Unit = {},
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // Wait until the meal plan is loaded before selecting — otherwise the lookup
    // runs against a null plan and selectedMeal stays null forever (blank screen).
    LaunchedEffect(mealId, state.mealPlan) {
        if (state.mealPlan != null) {
            viewModel.onIntent(NutritionIntent.SelectMeal(mealId))
        }
    }

    MealDetailScreen(state = state, onBackClick = onBackClick, onLogMeal = onLogMeal)
}

@Composable
fun MealDetailScreen(
    state: NutritionState,
    onBackClick: () -> Unit,
    onLogMeal: () -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxSize().background(DsTheme.colors.background)) {
        DsTopBar(title = stringResource(Res.string.meal_detail_screen_title), onBackClick = onBackClick, backContentDescription = stringResource(Res.string.back_cd))

        when {
            state.selectedMeal != null -> {
                MealContent(meal = state.selectedMeal, modifier = Modifier.weight(1f))
                DsButton(
                    text = stringResource(Res.string.log_this_meal),
                    onClick = onLogMeal,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp)
                )
            }
            state.isLoading || state.mealPlan == null -> DsLoadingBox()
            else -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = stringResource(Res.string.meal_not_found),
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.5f)
                )
            }
        }
    }
}

@Composable
private fun MealContent(meal: Meal, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier.background(DsTheme.colors.background),
        contentPadding = PaddingValues(bottom = 40.dp),
    ) {
        item("title") {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = meal.name.uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    color = DsTheme.colors.textPrimary,
                    letterSpacing = 0.5.sp,
                )
                meal.timeOfDay?.let {
                    Text(
                        text = it.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                        letterSpacing = 1.sp,
                    )
                }
            }
        }

        item("macros") { MacrosBand(meal) }

        item("ingredients-header") {
            Text(
                text = stringResource(Res.string.meal_ingredients_section),
                style = MaterialTheme.typography.labelMedium,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                letterSpacing = 1.5.sp,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
            )
        }

        items(meal.foods, key = { "food-${it.id}" }) { food ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = food.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = stringResource(Res.string.common_grams_format, food.amountGrams.toInt()),
                    style = MaterialTheme.typography.bodySmall,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                )
            }
        }
    }
}

@Composable
private fun MacrosBand(meal: Meal) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
            .background(
                DsTheme.colors.textPrimary.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        MacroItem("${meal.totalCalories.toInt()}", stringResource(Res.string.meal_macro_label_kcal))
        MacroItem("${meal.totalProtein.toInt()}g", stringResource(Res.string.meal_macro_label_protein))
        MacroItem("${meal.totalCarbs.toInt()}g", stringResource(Res.string.meal_macro_label_carbs))
        MacroItem("${meal.totalFat.toInt()}g", stringResource(Res.string.meal_macro_label_fat))
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            color = DsTheme.colors.textPrimary,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
        )
    }
}
