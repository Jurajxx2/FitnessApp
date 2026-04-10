package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.model.Recipe
import kotlinx.datetime.LocalDate

interface MealRepository {
    /** Returns the active coach-assigned meal plan for the user. */
    suspend fun getActiveMealPlan(userId: String): Result<MealPlan?>

    /** Returns all recipes. */
    suspend fun getRecipes(): Result<List<Recipe>>

    /** Returns a single recipe with its ingredients, or null if not found. */
    suspend fun getRecipeById(id: String): Result<Recipe?>

    /** Log a meal (user tracking). */
    suspend fun logMeal(
        userId: String,
        mealName: String,
        foods: List<MealLogFood>,
        notes: String?,
        imageBytes: ByteArray? = null
    ): Result<MealLog>

    /** Returns user's meal log history. */
    suspend fun getMealHistory(userId: String): Result<List<MealLog>>

    /** Returns today's nutrition summary from meal logs. */
    suspend fun getDailyNutritionSummary(
        userId: String,
        date: LocalDate
    ): Result<DailyNutritionSummary>
}
