package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository
import kotlinx.datetime.LocalDate

class MealRepositoryImpl(
    private val mealDataSource: MealRemoteDataSource
) : MealRepository {

    override suspend fun getActiveMealPlan(userId: String): Result<MealPlan?> = runCatching {
        mealDataSource.getActiveMealPlan(userId)?.toDomain()
    }

    override suspend fun logMeal(
        userId: String,
        mealName: String,
        foods: List<MealLogFood>,
        notes: String?
    ): Result<MealLog> = runCatching {
        val logDto = mealDataSource.insertMealLog(userId, mealName, notes)
        val foodPayloads = foods.map { food ->
            buildMap<String, Any?> {
                put("meal_log_id", logDto.id)
                put("name", food.name)
                put("amount_grams", food.amountGrams)
                put("calories", food.calories)
                put("protein_g", food.proteinG)
                put("carbs_g", food.carbsG)
                put("fat_g", food.fatG)
            }
        }
        val insertedFoods = if (foodPayloads.isNotEmpty()) {
            mealDataSource.insertMealLogFoods(foodPayloads)
        } else emptyList()

        logDto.copy(foods = insertedFoods).toDomain()
    }

    override suspend fun getMealHistory(userId: String): Result<List<MealLog>> = runCatching {
        mealDataSource.getMealHistory(userId).map { it.toDomain() }
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
}
