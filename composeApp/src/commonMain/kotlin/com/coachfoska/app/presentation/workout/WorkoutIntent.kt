package com.coachfoska.app.presentation.workout

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
    data object DismissError : WorkoutIntent
    data object WorkoutLogged : WorkoutIntent
}
