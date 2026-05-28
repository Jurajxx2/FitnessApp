package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetExerciseHistoryUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseName: String
    ): Result<List<ExerciseLog>> =
        workoutRepository.getExerciseHistory(userId, exerciseName)
}
