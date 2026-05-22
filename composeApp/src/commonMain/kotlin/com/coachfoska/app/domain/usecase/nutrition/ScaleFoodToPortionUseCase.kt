package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.model.MealLogFood

class ScaleFoodToPortionUseCase {
    operator fun invoke(food: Food, amount: Float, unit: String): MealLogFood {
        val safeAmount = amount.coerceAtLeast(0f)
        val ratio = when {
            unit != food.servingUnit -> 1f          // unit mismatch: trust food per-serving macros, count as 1 serving
            food.servingSize <= 0f   -> 0f
            else                     -> safeAmount / food.servingSize
        }
        return MealLogFood(
            id = "",
            mealLogId = "",
            name = food.name,
            amount = safeAmount,
            unit = unit,
            calories = food.calories * ratio,
            proteinG = food.proteinG * ratio,
            carbsG = food.carbsG * ratio,
            fatG = food.fatG * ratio,
        )
    }
}
