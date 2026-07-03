package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.repository.WorkoutRepository

class DeleteUserWorkoutUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(workoutId: String): Result<Unit> =
        workoutRepository.deleteUserWorkout(workoutId)
}
