package com.coachfoska.app.ui.nutrition

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealHistoryRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(NutritionIntent.LoadHistory)
    }

    MealHistoryScreen(state = state, onBackClick = onBackClick)
}

@Composable
fun MealHistoryScreen(
    state: NutritionState,
    onBackClick: () -> Unit
) {
    var expandedId by remember { mutableStateOf<String?>(null) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "Meal History", onBackClick = onBackClick)

        if (state.isHistoryLoading) {
            CoachLoadingBox()
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
                        Text(
                            text = "No meals logged yet.",
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            fontSize = 14.sp
                        )
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
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                text = log.mealName,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = log.loggedAt.toDisplayDateTime(),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                fontSize = 12.sp
            )
        }
        Text(
            text = "${log.totalCalories.toInt()} kcal · ${log.totalProtein.toInt()}g protein",
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 13.sp
        )
        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically(tween(200)) + fadeIn(tween(200)),
            exit = shrinkVertically(tween(150)) + fadeOut(tween(150))
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                log.foods.forEach { food ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = food.name,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                            fontSize = 13.sp,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "${food.calories.toInt()} kcal",
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}
