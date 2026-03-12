package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.WgerExercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExerciseByIdUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(id: Int): Result<WgerExercise> =
        exerciseRepository.getExerciseById(id)
}
