package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val DAY_LETTERS = listOf("M", "T", "W", "T", "F", "S", "S")

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
        onBackClick = onBackClick,
        onSelectDay = { viewModel.onIntent(NutritionIntent.SelectDay(it)) }
    )
}

@Composable
fun MealPlanDetailScreen(
    state: NutritionState,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit,
    onSelectDay: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "MEAL PLAN", onBackClick = onBackClick)

        if (state.isLoading) {
            CoachLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            DayStrip(
                selectedDay = state.selectedDayOfWeek,
                onSelectDay = onSelectDay,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)
            )

            val visibleMeals = state.mealPlan?.meals
                ?.filter { it.dayOfWeek == null || it.dayOfWeek == state.selectedDayOfWeek }
                ?: emptyList()

            if (visibleMeals.isNotEmpty()) {
                DailyMacroRow(
                    meals = visibleMeals,
                    modifier = Modifier.padding(start = 24.dp, end = 24.dp, bottom = 8.dp)
                )
            }

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
                if (visibleMeals.isNotEmpty()) {
                    items(visibleMeals.sortedBy { it.sortOrder }) { meal ->
                        MealPlanDetailCard(meal = meal, onClick = { onMealClick(meal.id) })
                    }
                } else {
                    item {
                        Text(
                            text = if (state.mealPlan == null) "No meal plan assigned yet."
                                   else "No meals for this day.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                        )
                    }
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
private fun DayStrip(
    selectedDay: Int,
    onSelectDay: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(DAY_LETTERS.size) { index ->
            val isSelected = index == selectedDay
            val bgColor = if (isSelected) MaterialTheme.colorScheme.onBackground
                          else MaterialTheme.colorScheme.surface
            val textColor = if (isSelected) MaterialTheme.colorScheme.background
                            else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(bgColor)
                    .clickable { onSelectDay(index) },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = DAY_LETTERS[index],
                    style = MaterialTheme.typography.labelMedium,
                    color = textColor
                )
            }
        }
    }
}

@Composable
private fun DailyMacroRow(
    meals: List<Meal>,
    modifier: Modifier = Modifier
) {
    val totalKcal = meals.sumOf { it.totalCalories.toDouble() }.toInt()
    val totalProtein = meals.sumOf { it.totalProtein.toDouble() }.toInt()
    val totalCarbs = meals.sumOf { it.totalCarbs.toDouble() }.toInt()
    val totalFat = meals.sumOf { it.totalFat.toDouble() }.toInt()

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            MacroItem(value = "$totalKcal", label = "KCAL")
            MacroDivider()
            MacroItem(value = "${totalProtein}G", label = "PROTEIN")
            MacroDivider()
            MacroItem(value = "${totalCarbs}G", label = "CARBS")
            MacroDivider()
            MacroItem(value = "${totalFat}G", label = "FAT")
        }
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
private fun MacroDivider() {
    Box(
        modifier = Modifier
            .size(3.dp)
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                CircleShape
            )
    )
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
            if (meal.foods.isNotEmpty()) {
                Text(
                    text = meal.foods.joinToString(" · ") { it.name },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
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
                Box(
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
