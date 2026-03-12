package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetAssignedWorkoutsUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(userId: String): Result<List<Workout>> =
        workoutRepository.getAssignedWorkouts(userId)
}
