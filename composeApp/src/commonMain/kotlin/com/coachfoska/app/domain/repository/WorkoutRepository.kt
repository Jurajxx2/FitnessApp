package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog

interface WorkoutRepository {
    /** Returns workouts assigned to the user by the coach. */
    suspend fun getAssignedWorkouts(userId: String): Result<List<Workout>>

    /** Returns a single workout with its exercises. */
    suspend fun getWorkoutById(workoutId: String): Result<Workout>

    /** Log a completed workout session. */
    suspend fun logWorkout(
        userId: String,
        workoutId: String?,
        workoutName: String,
        durationMinutes: Int,
        notes: String?,
        exerciseLogs: List<ExerciseLog>
    ): Result<WorkoutLog>

    /** Returns user's logged workout history. */
    suspend fun getWorkoutHistory(userId: String): Result<List<WorkoutLog>>
}
