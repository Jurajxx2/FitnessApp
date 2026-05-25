package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.repository.ExerciseRepository

class ToggleFavoriteExerciseUseCase(private val repository: ExerciseRepository) {
    suspend operator fun invoke(userId: String, exerciseId: String, isFavorite: Boolean): Result<Unit> =
        repository.setFavorite(userId, exerciseId, isFavorite)
}
