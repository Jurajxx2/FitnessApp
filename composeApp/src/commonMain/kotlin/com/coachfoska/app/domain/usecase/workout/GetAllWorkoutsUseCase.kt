package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetAllWorkoutsUseCase(private val workoutRepository: WorkoutRepository) {
    suspend operator fun invoke(): Result<List<Workout>> =
        workoutRepository.getAllWorkouts()
}
