package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.domain.repository.MealRepository

class LogMealUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(
        userId: String,
        mealName: String,
        foods: List<MealLogFood>,
        notes: String?
    ): Result<MealLog> = mealRepository.logMeal(userId, mealName, foods, notes)
}
