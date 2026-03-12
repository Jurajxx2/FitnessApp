package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.MealLogFood

sealed interface NutritionIntent {
    data object LoadMealPlan : NutritionIntent
    data object LoadHistory : NutritionIntent
    data class SelectMeal(val mealId: String) : NutritionIntent
    data class LogMeal(
        val mealName: String,
        val foods: List<MealLogFood>,
        val notes: String?
    ) : NutritionIntent
    data object DismissError : NutritionIntent
    data object MealLogged : NutritionIntent
}
