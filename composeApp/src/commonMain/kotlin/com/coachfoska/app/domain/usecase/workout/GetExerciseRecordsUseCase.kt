package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetExerciseRecordsUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseName: String
    ): Result<ExerciseRecords> =
        workoutRepository.getExerciseRecords(userId, exerciseName)
}
