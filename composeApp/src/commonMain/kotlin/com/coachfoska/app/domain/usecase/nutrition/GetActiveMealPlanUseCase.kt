package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository

class GetActiveMealPlanUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(userId: String): Result<MealPlan?> =
        mealRepository.getActiveMealPlan(userId)
}
