package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate

data class MealPlan(
    val id: String,
    val name: String,
    val description: String?,
    val meals: List<Meal>,
    val validFrom: LocalDate?,
    val validTo: LocalDate?
)

data class Meal(
    val id: String,
    val mealPlanId: String,
    val name: String,
    val timeOfDay: String?,
    val sortOrder: Int,
    val foods: List<MealFood>
) {
    val totalCalories: Float get() = foods.sumOf { it.calories.toDouble() }.toFloat()
    val totalProtein: Float get() = foods.sumOf { it.proteinG.toDouble() }.toFloat()
    val totalCarbs: Float get() = foods.sumOf { it.carbsG.toDouble() }.toFloat()
    val totalFat: Float get() = foods.sumOf { it.fatG.toDouble() }.toFloat()
}

data class MealFood(
    val id: String,
    val mealId: String,
    val name: String,
    val amountGrams: Float,
    val calories: Float,
    val proteinG: Float,
    val carbsG: Float,
    val fatG: Float
)

data class MealLog(
    val id: String,
    val userId: String,
    val mealName: String,
    val notes: String?,
    val foods: List<MealLogFood>,
    val imageUrl: String? = null,
    val loggedAt: Instant
) {
    val totalCalories: Float get() = foods.sumOf { it.calories.toDouble() }.toFloat()
    val totalProtein: Float get() = foods.sumOf { it.proteinG.toDouble() }.toFloat()
    val totalCarbs: Float get() = foods.sumOf { it.carbsG.toDouble() }.toFloat()
    val totalFat: Float get() = foods.sumOf { it.fatG.toDouble() }.toFloat()
}

data class MealLogFood(
    val id: String,
    val mealLogId: String,
    val name: String,
    val amountGrams: Float,
    val calories: Float,
    val proteinG: Float,
    val carbsG: Float,
    val fatG: Float
)

data class DailyNutritionSummary(
    val calories: Float,
    val proteinG: Float,
    val carbsG: Float,
    val fatG: Float
)
