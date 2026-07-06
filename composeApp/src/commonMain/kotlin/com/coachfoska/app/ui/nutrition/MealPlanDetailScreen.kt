package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.theme.Sizes
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.meal_plan_assigned_meals
import coachfoska.composeapp.generated.resources.meal_plan_count_planned
import coachfoska.composeapp.generated.resources.meal_plan_daily_plan
import coachfoska.composeapp.generated.resources.meal_plan_macro_carbs
import coachfoska.composeapp.generated.resources.meal_plan_macro_fat
import coachfoska.composeapp.generated.resources.meal_plan_macro_kcal
import coachfoska.composeapp.generated.resources.meal_plan_macro_protein
import coachfoska.composeapp.generated.resources.meal_plan_no_meals_for_day
import coachfoska.composeapp.generated.resources.meal_plan_no_plan
import coachfoska.composeapp.generated.resources.meal_plan_record_meal
import coachfoska.composeapp.generated.resources.meal_plan_screen_title
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val DAY_LETTERS = listOf("M", "T", "W", "T", "F", "S", "S")

@Composable
fun MealPlanDetailRoute(
    userId: String,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MealPlanDetailScreen(
        state = state,
        onMealClick = onMealClick,
        onRecordMealClick = onRecordMealClick,
        onBackClick = onBackClick,
        onSelectDay = { viewModel.onIntent(NutritionIntent.SelectDay(it)) },
    )
}

@Composable
fun MealPlanDetailScreen(
    state: NutritionState,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit,
    onSelectDay: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = stringResource(Res.string.meal_plan_screen_title), onBackClick = onBackClick)

        if (state.isLoading) {
            DsLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            val visibleMeals = state.mealPlan?.meals
                ?.filter { it.dayOfWeek == null || it.dayOfWeek == state.selectedDayOfWeek }
                ?.sortedBy { it.sortOrder }
                ?: emptyList()

            DayStrip(
                selectedDay = state.selectedDayOfWeek,
                onSelectDay = onSelectDay,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
            )

            if (visibleMeals.isNotEmpty()) {
                DailyMacroRow(
                    meals = visibleMeals,
                    modifier = Modifier.padding(start = 24.dp, end = 24.dp, bottom = 8.dp),
                )
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item {
                    PlanHeader(planName = state.mealPlan?.name, mealCount = visibleMeals.size)
                }
                if (visibleMeals.isNotEmpty()) {
                    items(visibleMeals, key = { it.id }) { meal ->
                        MealPlanDetailCard(meal = meal, onClick = { onMealClick(meal.id) })
                    }
                } else {
                    item {
                        Text(
                            text = if (state.mealPlan == null) stringResource(Res.string.meal_plan_no_plan) else stringResource(Res.string.meal_plan_no_meals_for_day),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        )
                    }
                }
            }

            Surface(
                color = MaterialTheme.colorScheme.background,
                shadowElevation = 8.dp,
            ) {
                DsButton(
                    text = stringResource(Res.string.meal_plan_record_meal),
                    onClick = onRecordMealClick,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 18.dp),
                )
            }
        }
    }
}

@Composable
private fun DayStrip(
    selectedDay: Int,
    onSelectDay: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(DAY_LETTERS.size) { index ->
            val isSelected = index == selectedDay
            val bgColor = if (isSelected) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.surface
            val textColor = if (isSelected) MaterialTheme.colorScheme.background else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            Box(
                modifier = Modifier
                    .size(Sizes.touchTarget)
                    .clickable { onSelectDay(index) },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(bgColor),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = DAY_LETTERS[index],
                        style = MaterialTheme.typography.labelMedium,
                        color = textColor,
                    )
                }
            }
        }
    }
}

@Composable
private fun PlanHeader(planName: String?, mealCount: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = stringResource(Res.string.meal_plan_daily_plan),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.5.sp,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                text = planName ?: stringResource(Res.string.meal_plan_assigned_meals),
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = stringResource(Res.string.meal_plan_count_planned, mealCount),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.48f),
            )
        }
    }
}

@Composable
private fun DailyMacroRow(
    meals: List<Meal>,
    modifier: Modifier = Modifier,
) {
    val totalKcal = meals.sumOf { it.totalCalories.toDouble() }.toInt()
    val totalProtein = meals.sumOf { it.totalProtein.toDouble() }.toInt()
    val totalCarbs = meals.sumOf { it.totalCarbs.toDouble() }.toInt()
    val totalFat = meals.sumOf { it.totalFat.toDouble() }.toInt()

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MacroItem(value = "$totalKcal", label = stringResource(Res.string.meal_plan_macro_kcal))
            MacroDivider()
            MacroItem(value = "${totalProtein}G", label = stringResource(Res.string.meal_plan_macro_protein))
            MacroDivider()
            MacroItem(value = "${totalCarbs}G", label = stringResource(Res.string.meal_plan_macro_carbs))
            MacroDivider()
            MacroItem(value = "${totalFat}G", label = stringResource(Res.string.meal_plan_macro_fat))
        }
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 0.5.sp,
        )
    }
}

@Composable
private fun MacroDivider() {
    Box(
        modifier = Modifier
            .size(3.dp)
            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), CircleShape),
    )
}

@Composable
private fun MealPlanDetailCard(meal: Meal, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        modifier = Modifier.size(34.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.Restaurant,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                    Text(
                        text = meal.name,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                meal.timeOfDay?.let {
                    Text(
                        text = it.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 0.5.sp,
                    )
                }
            }
            if (meal.foods.isNotEmpty()) {
                Text(
                    text = meal.foods.joinToString(" + ") { it.name },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MealMacroChip("${meal.totalCalories.toInt()} kcal")
                MealMacroChip("P ${meal.totalProtein.toInt()}g")
                MealMacroChip("C ${meal.totalCarbs.toInt()}g")
                MealMacroChip("F ${meal.totalFat.toInt()}g")
            }
        }
    }
}

@Composable
private fun MealMacroChip(text: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.045f),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.62f),
        )
    }
}
