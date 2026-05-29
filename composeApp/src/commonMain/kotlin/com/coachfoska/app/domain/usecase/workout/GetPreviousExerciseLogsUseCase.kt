package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetPreviousExerciseLogsUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseNames: List<String>
    ): Result<Map<String, List<SetLog>>> =
        workoutRepository.getLastLogsForExercises(userId, exerciseNames)
}
