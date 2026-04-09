package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class SearchExercisesUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(query: String): Result<List<Exercise>> {
        if (query.isBlank()) return Result.success(emptyList())
        return exerciseRepository.searchExercises(query.trim())
    }
}
