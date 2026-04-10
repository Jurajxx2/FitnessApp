package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.repository.MealRepository

class GetRecipeByIdUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(id: String): Result<Recipe?> =
        mealRepository.getRecipeById(id)
}
