package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetWorkoutByIdUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(workoutId: String): Result<Workout> =
        workoutRepository.getWorkoutById(workoutId)
}
