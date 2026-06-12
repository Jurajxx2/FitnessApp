package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.repository.MealRepository

class SearchFoodsUseCase(private val mealRepository: MealRepository) {
    suspend operator fun invoke(query: String): Result<List<Food>> {
        return mealRepository.searchFoods(query)
    }
}
