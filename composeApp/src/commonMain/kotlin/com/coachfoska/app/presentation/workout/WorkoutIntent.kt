package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.ExerciseLog

sealed interface WorkoutIntent {
    data object LoadWorkouts : WorkoutIntent
    data class SelectWorkout(val workoutId: String) : WorkoutIntent
    data object LoadHistory : WorkoutIntent
    data class LogWorkout(
        val workoutId: String?,
        val workoutName: String,
        val durationMinutes: Int,
        val notes: String?,
        val exerciseLogs: List<ExerciseLog>
    ) : WorkoutIntent

    data object LoadActivityHistory : WorkoutIntent
    data class LogGeneralActivity(
        val type: ActivityType,
        val durationMinutes: Int,
        val distanceKm: Double?,
        val rpe: Int?,
        val notes: String?,
    ) : WorkoutIntent

    data object DismissError : WorkoutIntent
    data object WorkoutLogged : WorkoutIntent
    data class SelectWorkoutLog(val logId: String) : WorkoutIntent
    data class AttachVideoToLog(val exerciseLogId: String, val videoBytes: ByteArray) : WorkoutIntent
}
