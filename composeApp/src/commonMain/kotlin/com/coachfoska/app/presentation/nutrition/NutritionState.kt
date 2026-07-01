package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.model.Recipe

data class CapturePrefillFood(
    val name: String,
    val amount: Float,
    val unit: String,
    val calories: Float,
    val proteinG: Float,
    val carbsG: Float,
    val fatG: Float
)

data class CapturePrefill(
    val mealName: String,
    val foods: List<CapturePrefillFood>
)

data class NutritionState(
    val isLoading: Boolean = false,
    val mealPlan: MealPlan? = null,
    val selectedDayOfWeek: Int = 0,
    val selectedMeal: Meal? = null,
    val mealHistory: List<MealLog> = emptyList(),
    val selectedMealLog: MealLog? = null,
    val isHistoryLoading: Boolean = false,
    val allRecipes: List<Recipe> = emptyList(),
    val isRecipesLoading: Boolean = false,
    val favoriteRecipeIds: Set<String> = emptySet(),
    val showOnlyFavorites: Boolean = false,
    val searchResults: List<Food> = emptyList(),
    val isSearching: Boolean = false,
    val isLogging: Boolean = false,
    val isAnalyzing: Boolean = false,
    val mealLoggedSuccess: Boolean = false,
    val capturePrefill: CapturePrefill? = null,
    val error: String? = null
) {
    val recipes: List<Recipe>
        get() = if (showOnlyFavorites) allRecipes.filter { it.id in favoriteRecipeIds } else allRecipes

    val featuredRecipes: List<Recipe>
        get() = allRecipes.filter { it.isFeatured }.ifEmpty { allRecipes.take(10) }
}
