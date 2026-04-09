package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExercisesByCategoryUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(categoryId: Int): Result<List<Exercise>> =
        exerciseRepository.getExercisesByCategory(categoryId)
}
