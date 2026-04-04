package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.WgerExercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExercisesByCategoryUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(categoryId: Int): Result<List<WgerExercise>> =
        exerciseRepository.getExercisesByCategory(categoryId)
}
