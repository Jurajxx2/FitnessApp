package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.app.domain.repository.MealRepository

class GetActiveNutritionTargetUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(userId: String): Result<MacroTargets?> =
        mealRepository.getActiveNutritionTarget(userId)
}
