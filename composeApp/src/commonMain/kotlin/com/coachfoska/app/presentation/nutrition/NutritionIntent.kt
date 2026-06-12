package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.MealLogFood

sealed interface NutritionIntent {
    data object LoadMealPlan : NutritionIntent
    data object LoadHistory : NutritionIntent
    data class SelectMeal(val mealId: String) : NutritionIntent
    data class SelectMealLog(val logId: String) : NutritionIntent
    data object LoadRecipes : NutritionIntent
    data class LogMeal(
        val mealName: String,
        val foods: List<MealLogFood>,
        val notes: String?,
        val photoUri: String? = null
    ) : NutritionIntent
    data object DismissError : NutritionIntent
    data object MealLogged : NutritionIntent
    data class SearchFoods(val query: String) : NutritionIntent
    data class SelectDay(val dayOfWeek: Int) : NutritionIntent
    data class ToggleFavoriteRecipe(val recipeId: String) : NutritionIntent
    data object ToggleFavoritesFilter : NutritionIntent
    data class LoadCapturePrefill(val recipeId: String?, val mealId: String?) : NutritionIntent
}
