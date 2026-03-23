package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import androidx.compose.material3.*
import androidx.compose.runtime.*
import org.koin.core.parameter.parametersOf

data class FoodEntry(
    val name: String,
    val calories: String,
    val protein: String,
    val carbs: String,
    val fat: String
)

@Composable
fun MealCaptureRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.mealLoggedSuccess) {
        if (state.mealLoggedSuccess) {
            viewModel.onIntent(NutritionIntent.MealLogged)
            onBackClick()
        }
    }

    MealCaptureScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealCaptureScreen(
    state: NutritionState,
    onIntent: (NutritionIntent) -> Unit,
    onBackClick: () -> Unit
) {
    var mealName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var foods by remember { mutableStateOf(listOf(FoodEntry("", "", "", "", ""))) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("RECORD MEAL", style = MaterialTheme.typography.labelLarge, letterSpacing = 1.sp) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            CoachTextField(
                value = mealName,
                onValueChange = { mealName = it },
                label = "Meal Name (e.g. Breakfast)"
            )

            CoachSectionHeader(text = "FOOD ITEMS")

            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                foods.forEachIndexed { i, food ->
                    FoodEntryRow(
                        index = i + 1,
                        food = food,
                        onUpdate = { updated ->
                            foods = foods.toMutableList().also { it[i] = updated }
                        },
                        onRemove = if (foods.size > 1) {
                            { foods = foods.toMutableList().also { it.removeAt(i) } }
                        } else null
                    )
                }
                
                OutlinedButton(
                    onClick = { foods = foods + FoodEntry("", "", "", "", "") },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onBackground),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f))
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("ADD FOOD", style = MaterialTheme.typography.labelLarge)
                }
            }

            CoachTextField(
                value = notes,
                onValueChange = { notes = it },
                label = "Notes (optional)",
                singleLine = false
            )

            state.error?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            CoachButton(
                text = "SAVE MEAL",
                onClick = {
                    val mealLogFoods = foods.filter { it.name.isNotBlank() }.map {
                        MealLogFood(
                            id = "", mealLogId = "",
                            name = it.name,
                            amountGrams = 100f,
                            calories = it.calories.toFloatOrNull() ?: 0f,
                            proteinG = it.protein.toFloatOrNull() ?: 0f,
                            carbsG = it.carbs.toFloatOrNull() ?: 0f,
                            fatG = it.fat.toFloatOrNull() ?: 0f
                        )
                    }
                    onIntent(
                        NutritionIntent.LogMeal(
                            mealName = mealName,
                            foods = mealLogFoods,
                            notes = notes.ifBlank { null }
                        )
                    )
                },
                enabled = mealName.isNotBlank() && foods.any { it.name.isNotBlank() },
                isLoading = state.isLogging
            )
            
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun FoodEntryRow(
    index: Int,
    food: FoodEntry,
    onUpdate: (FoodEntry) -> Unit,
    onRemove: (() -> Unit)?
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "FOOD #$index",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
                if (onRemove != null) {
                    IconButton(onClick = onRemove, modifier = Modifier.size(24.dp)) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Remove",
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            CoachTextField(
                value = food.name,
                onValueChange = { onUpdate(food.copy(name = it)) },
                label = "Food Name"
            )
            
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CoachTextField(
                    value = food.calories,
                    onValueChange = { onUpdate(food.copy(calories = it)) },
                    label = "kcal",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
                CoachTextField(
                    value = food.protein,
                    onValueChange = { onUpdate(food.copy(protein = it)) },
                    label = "protein (g)",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }
        }
    }
}
