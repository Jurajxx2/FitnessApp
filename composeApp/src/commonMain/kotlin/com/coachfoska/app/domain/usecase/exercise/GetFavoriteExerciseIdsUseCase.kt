package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.repository.ExerciseRepository

class GetFavoriteExerciseIdsUseCase(private val repository: ExerciseRepository) {
    suspend operator fun invoke(userId: String): Result<Set<String>> =
        repository.getFavoriteIds(userId)
}
