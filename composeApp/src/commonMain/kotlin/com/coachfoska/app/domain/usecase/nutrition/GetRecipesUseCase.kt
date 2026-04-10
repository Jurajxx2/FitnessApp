package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.repository.MealRepository

class GetRecipesUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(): Result<List<Recipe>> =
        mealRepository.getRecipes()
}
