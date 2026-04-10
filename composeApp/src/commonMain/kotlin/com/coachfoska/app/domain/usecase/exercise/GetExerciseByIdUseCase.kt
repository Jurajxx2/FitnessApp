package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExerciseByIdUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(id: String): Result<Exercise> =
        exerciseRepository.getExerciseById(id)
}
