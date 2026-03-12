package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class LogWorkoutUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(
        userId: String,
        workoutId: String?,
        workoutName: String,
        durationMinutes: Int,
        notes: String?,
        exerciseLogs: List<ExerciseLog>
    ): Result<WorkoutLog> = workoutRepository.logWorkout(
        userId, workoutId, workoutName, durationMinutes, notes, exerciseLogs
    )
}
