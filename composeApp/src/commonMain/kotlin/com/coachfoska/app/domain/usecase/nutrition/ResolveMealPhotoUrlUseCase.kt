package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository

class ResolveMealPhotoUrlUseCase(private val repository: MealRepository) {
    suspend operator fun invoke(path: String): Result<String> =
        repository.signedMealPhotoUrl(path)
}
