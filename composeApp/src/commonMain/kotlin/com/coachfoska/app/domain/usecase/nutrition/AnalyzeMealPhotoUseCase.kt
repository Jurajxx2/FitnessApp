package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealPhotoAnalysis
import com.coachfoska.app.domain.repository.MealRepository

class AnalyzeMealPhotoUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(imageBytes: ByteArray): Result<MealPhotoAnalysis> =
        mealRepository.analyzeMealPhoto(imageBytes)
}
