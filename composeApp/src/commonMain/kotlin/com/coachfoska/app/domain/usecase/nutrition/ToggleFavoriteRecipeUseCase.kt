package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository

class ToggleFavoriteRecipeUseCase(private val repository: MealRepository) {
    suspend operator fun invoke(userId: String, recipeId: String, isFavorite: Boolean): Result<Unit> =
        repository.setRecipeFavorite(userId, recipeId, isFavorite)
}
