package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan

data class NutritionState(
    val isLoading: Boolean = false,
    val mealPlan: MealPlan? = null,
    val selectedDayOfWeek: Int = 0,
    val selectedMeal: Meal? = null,
    val mealHistory: List<MealLog> = emptyList(),
    val selectedMealLog: MealLog? = null,
    val isHistoryLoading: Boolean = false,
    val recipes: List<com.coachfoska.app.domain.model.Recipe> = emptyList(),
    val isRecipesLoading: Boolean = false,
    val searchResults: List<Food> = emptyList(),
    val isSearching: Boolean = false,
    val isLogging: Boolean = false,
    val mealLoggedSuccess: Boolean = false,
    val error: String? = null
)
