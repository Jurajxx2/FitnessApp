package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository

class GetFavoriteRecipeIdsUseCase(private val repository: MealRepository) {
    suspend operator fun invoke(userId: String): Result<Set<String>> =
        repository.getFavoriteRecipeIds(userId)
}
