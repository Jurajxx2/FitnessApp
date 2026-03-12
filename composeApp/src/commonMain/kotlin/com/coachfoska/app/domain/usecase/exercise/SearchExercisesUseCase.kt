package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.WgerExercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class SearchExercisesUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(query: String): Result<List<WgerExercise>> {
        if (query.isBlank()) return Result.success(emptyList())
        return exerciseRepository.searchExercises(query.trim())
    }
}
