package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.MealPhotoDataSource
import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.data.remote.dto.MealLogFoodInsertDto
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.domain.model.MealPhotoAnalysis
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.repository.MealRepository
import kotlinx.datetime.LocalDate

class MealRepositoryImpl(
    private val mealDataSource: MealRemoteDataSource,
    private val mealPhotoDataSource: MealPhotoDataSource
) : MealRepository {

    override suspend fun getActiveNutritionTarget(userId: String) = runCatching {
        mealDataSource.getActiveNutritionTarget(userId)?.toDomain()
    }

    override suspend fun getRecipes(): Result<List<Recipe>> = runCatching {
        mealDataSource.getRecipes().map { it.toDomain() }
    }

    override suspend fun getRecipeById(id: String): Result<Recipe?> = runCatching {
        mealDataSource.getRecipeById(id)?.toDomain()
    }

    override suspend fun getActiveMealPlan(userId: String): Result<MealPlan?> = runCatching {
        mealDataSource.getActiveMealPlan(userId)?.toDomain()
    }

    override suspend fun logMeal(
        userId: String,
        mealName: String,
        foods: List<MealLogFood>,
        notes: String?,
        imageBytes: ByteArray?
    ): Result<MealLog> = runCatching {
        // Best-effort upload — a failed upload must never block logging the meal.
        val imageUrl: String? = imageBytes?.let { bytes ->
            runCatching { mealPhotoDataSource.uploadMealPhoto(userId, bytes) }.getOrNull()
        }

        val logDto = mealDataSource.insertMealLog(userId, mealName, notes, imageUrl)
        val foodPayloads = foods.map { food ->
            // meal_log_foods_portion_valid CHECK constraint: amount_grams may only be set
            // when unit == "g" (and must then equal amount); unit must be non-empty.
            val unit = food.unit.ifBlank { "g" }
            MealLogFoodInsertDto(
                mealLogId = logDto.id,
                name = food.name,
                amount = food.amount,
                unit = unit,
                amountGrams = if (unit == "g") food.amount else null,
                calories = food.calories,
                proteinG = food.proteinG,
                carbsG = food.carbsG,
                fatG = food.fatG,
            )
        }
        val insertedFoods = if (foodPayloads.isNotEmpty()) {
            mealDataSource.insertMealLogFoods(foodPayloads)
        } else emptyList()

        logDto.copy(foods = insertedFoods).toDomain()
    }

    override suspend fun analyzeMealPhoto(imageBytes: ByteArray): Result<MealPhotoAnalysis> = runCatching {
        mealPhotoDataSource.analyzeMealPhoto(imageBytes).toDomain()
    }

    override suspend fun signedMealPhotoUrl(path: String): Result<String> = runCatching {
        mealPhotoDataSource.signedMealPhotoUrl(path)
    }

    override suspend fun getMealHistory(userId: String): Result<List<MealLog>> = runCatching {
        mealDataSource.getMealHistory(userId).map { it.toDomain() }
    }

    override suspend fun searchFoods(query: String): Result<List<Food>> = runCatching {
        mealDataSource.searchFoods(query).map { it.toDomain() }
    }

    override suspend fun getDailyNutritionSummary(
        userId: String,
        date: LocalDate
    ): Result<DailyNutritionSummary> = runCatching {
        val logs = mealDataSource.getMealLogsByDate(userId, date).map { it.toDomain() }
        DailyNutritionSummary(
            calories = logs.sumOf { it.totalCalories.toDouble() }.toFloat(),
            proteinG = logs.sumOf { it.totalProtein.toDouble() }.toFloat(),
            carbsG = logs.sumOf { it.totalCarbs.toDouble() }.toFloat(),
            fatG = logs.sumOf { it.totalFat.toDouble() }.toFloat()
        )
    }

    override suspend fun getFavoriteRecipeIds(userId: String): Result<Set<String>> = runCatching {
        mealDataSource.getFavoriteRecipeIds(userId).toSet()
    }

    override suspend fun setRecipeFavorite(userId: String, recipeId: String, isFavorite: Boolean): Result<Unit> = runCatching {
        if (isFavorite) mealDataSource.addFavoriteRecipe(userId, recipeId)
        else mealDataSource.removeFavoriteRecipe(userId, recipeId)
    }
}
