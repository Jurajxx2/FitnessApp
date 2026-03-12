package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.repository.MealRepository

class GetMealHistoryUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(userId: String): Result<List<MealLog>> =
        mealRepository.getMealHistory(userId)
}
