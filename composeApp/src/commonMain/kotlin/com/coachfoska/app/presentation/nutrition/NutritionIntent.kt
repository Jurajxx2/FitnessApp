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
        val imageBytes: ByteArray? = null
    ) : NutritionIntent
    data class AnalyzePhoto(val imageBytes: ByteArray) : NutritionIntent
    data object DismissError : NutritionIntent
    data object MealLogged : NutritionIntent
    data class SearchFoods(val query: String) : NutritionIntent
    data class SelectDay(val dayOfWeek: Int) : NutritionIntent
    data class ToggleFavoriteRecipe(val recipeId: String) : NutritionIntent
    data object ToggleFavoritesFilter : NutritionIntent
    data class LoadCapturePrefill(val recipeId: String?, val mealId: String?) : NutritionIntent
    data object CapturePrefillConsumed : NutritionIntent
    data object LoadDailySummary : NutritionIntent
    data class LookupBarcode(val barcode: String) : NutritionIntent
    data object BarcodeConsumed : NutritionIntent
}
