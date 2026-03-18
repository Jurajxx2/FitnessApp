package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

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

@Composable
fun MealCaptureScreen(
    state: NutritionState,
    onIntent: (NutritionIntent) -> Unit,
    onBackClick: () -> Unit
) {
    data class FoodEntry(val name: String, val calories: String, val protein: String, val carbs: String, val fat: String)

    var mealName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var foods by remember { mutableStateOf(listOf(FoodEntry("", "", "", "", ""))) }

    Column(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        CoachTopBar(title = "Record Meal", onBackClick = onBackClick)

        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            NutritionTextField(value = mealName, onValueChange = { mealName = it }, label = "Meal name")

            Text("FOODS", color = Color(0xFFA90707), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.5.sp)

            foods.forEachIndexed { i, food ->
                Column(
                    modifier = Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(8.dp)).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    NutritionTextField(value = food.name, onValueChange = { foods = foods.toMutableList().also { l -> l[i] = food.copy(name = it) } }, label = "Food name")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NutritionTextField(value = food.calories, onValueChange = { foods = foods.toMutableList().also { l -> l[i] = food.copy(calories = it) } }, label = "kcal", modifier = Modifier.weight(1f), keyboardType = KeyboardType.Decimal)
                        NutritionTextField(value = food.protein, onValueChange = { foods = foods.toMutableList().also { l -> l[i] = food.copy(protein = it) } }, label = "protein(g)", modifier = Modifier.weight(1f), keyboardType = KeyboardType.Decimal)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NutritionTextField(value = food.carbs, onValueChange = { foods = foods.toMutableList().also { l -> l[i] = food.copy(carbs = it) } }, label = "carbs(g)", modifier = Modifier.weight(1f), keyboardType = KeyboardType.Decimal)
                        NutritionTextField(value = food.fat, onValueChange = { foods = foods.toMutableList().also { l -> l[i] = food.copy(fat = it) } }, label = "fat(g)", modifier = Modifier.weight(1f), keyboardType = KeyboardType.Decimal)
                    }
                }
            }

            TextButton(onClick = { foods = foods + FoodEntry("", "", "", "", "") }) {
                Text("+ ADD FOOD", color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp)
            }

            NutritionTextField(value = notes, onValueChange = { notes = it }, label = "Notes (optional)", singleLine = false)

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }

            Button(
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
                    onIntent(NutritionIntent.LogMeal(mealName = mealName, foods = mealLogFoods, notes = notes.ifBlank { null }))
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707)),
                enabled = mealName.isNotBlank() && !state.isLogging
            ) {
                if (state.isLogging) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("SAVE MEAL", fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
                }
            }
        }
    }
}

@Composable
private fun NutritionTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label, color = Color.White.copy(alpha = 0.6f)) },
        singleLine = singleLine,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedBorderColor = Color(0xFFA90707),
            unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
            cursorColor = Color(0xFFA90707)
        )
    )
}
