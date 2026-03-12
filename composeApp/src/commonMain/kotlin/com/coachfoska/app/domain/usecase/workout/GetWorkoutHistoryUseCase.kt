package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetWorkoutHistoryUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(userId: String): Result<List<WorkoutLog>> =
        workoutRepository.getWorkoutHistory(userId)
}
