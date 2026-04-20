package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealHistoryDetailRoute(
    logId: String,
    userId: String,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(logId) {
        if (state.mealHistory.isEmpty()) {
            viewModel.onIntent(NutritionIntent.LoadHistory)
        }
        viewModel.onIntent(NutritionIntent.SelectMealLog(logId))
    }

    LaunchedEffect(state.mealHistory) {
        if (state.mealHistory.isNotEmpty()) {
            viewModel.onIntent(NutritionIntent.SelectMealLog(logId))
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "MEAL DETAIL", onBackClick = onBackClick)
        when {
            state.isHistoryLoading -> CoachLoadingBox(Modifier.weight(1f))
            state.selectedMealLog != null -> MealHistoryDetailScreen(
                log = state.selectedMealLog!!,
                modifier = Modifier.weight(1f)
            )
            else -> Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Text(
                    text = "Meal log not found.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
            }
        }
    }
}

@Composable
private fun MealHistoryDetailScreen(log: MealLog, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(bottom = 40.dp)
    ) {
        // Photo
        if (log.imageUrl != null) {
            item {
                AsyncImage(
                    model = log.imageUrl,
                    contentDescription = log.mealName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp)
                )
            }
        }

        // Name + date
        item {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = log.mealName.uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = log.loggedAt.toDisplayDateTime(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.45f)
                )
                if (!log.notes.isNullOrBlank()) {
                    Text(
                        text = log.notes,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        // Macros band
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 8.dp)
                    .then(
                        Modifier.padding(0.dp) // placeholder for background via Surface
                    ),
                horizontalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        MacroItem(value = "${log.totalCalories.toInt()}", label = "kcal")
                        MacroItem(value = "${log.totalProtein.toInt()}g", label = "protein")
                        MacroItem(value = "${log.totalCarbs.toInt()}g", label = "carbs")
                        MacroItem(value = "${log.totalFat.toInt()}g", label = "fat")
                    }
                }
            }
        }

        // Foods header
        if (log.foods.isNotEmpty()) {
            item {
                Text(
                    text = "FOOD ITEMS",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)
                )
            }
            items(log.foods, key = { it.id.ifBlank { it.name } }) { food ->
                FoodDetailRow(food = food)
            }
        }
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun FoodDetailRow(food: MealLogFood) {
    Column(modifier = Modifier.padding(horizontal = 24.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = food.name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.weight(1f)
            )
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "${food.calories.toInt()} kcal",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "P ${food.proteinG.toInt()}g · C ${food.carbsG.toInt()}g · F ${food.fatG.toInt()}g",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.45f)
                )
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    }
}
