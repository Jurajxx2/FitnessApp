package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun MealHistoryScreen(
    nutritionViewModel: NutritionViewModel,
    onBackClick: () -> Unit
) {
    val state by nutritionViewModel.state.collectAsStateWithLifecycle()
    var expandedId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        nutritionViewModel.onIntent(NutritionIntent.LoadHistory)
    }

    Column(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        CoachTopBar(title = "Meal History", onBackClick = onBackClick)

        if (state.isHistoryLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFA90707))
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.mealHistory) { log ->
                    MealLogCard(
                        log = log,
                        isExpanded = expandedId == log.id,
                        onClick = { expandedId = if (expandedId == log.id) null else log.id }
                    )
                }
                if (state.mealHistory.isEmpty()) {
                    item {
                        Text("No meals logged yet.", color = Color.White.copy(alpha = 0.5f), fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun MealLogCard(log: MealLog, isExpanded: Boolean, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = log.mealName, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text(text = log.loggedAt.toDisplayDateTime(), color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp)
        }
        Text(text = "${log.totalCalories.toInt()} kcal · ${log.totalProtein.toInt()}g protein", color = Color.White.copy(alpha = 0.5f), fontSize = 13.sp)
        if (isExpanded) {
            log.foods.forEach { food ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = food.name, color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text(text = "${food.calories.toInt()} kcal", color = Color.White.copy(alpha = 0.5f), fontSize = 13.sp)
                }
            }
        }
    }
}
