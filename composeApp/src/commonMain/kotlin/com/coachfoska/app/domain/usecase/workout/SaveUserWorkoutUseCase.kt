package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutDraft
import com.coachfoska.app.domain.repository.WorkoutRepository

class SaveUserWorkoutUseCase(private val workoutRepository: WorkoutRepository) {
    /**
     * Creates a new user workout when [workoutId] is null,
     * or updates the existing one when [workoutId] is provided.
     */
    suspend operator fun invoke(
        userId: String,
        draft: WorkoutDraft,
        workoutId: String? = null,
    ): Result<Workout> = if (workoutId == null) {
        workoutRepository.createUserWorkout(userId, draft)
    } else {
        workoutRepository.updateUserWorkout(workoutId, draft)
    }
}
