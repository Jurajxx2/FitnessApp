package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.repository.MealRepository
import kotlinx.datetime.LocalDate

class GetDailyNutritionSummaryUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(userId: String, date: LocalDate): Result<DailyNutritionSummary> =
        mealRepository.getDailyNutritionSummary(userId, date)
}
