package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.ExerciseLog

sealed interface WorkoutIntent {
    data object LoadWorkouts : WorkoutIntent
    data object LoadAllWorkouts : WorkoutIntent
    data class SelectWorkout(val workoutId: String) : WorkoutIntent
    data object LoadHistory : WorkoutIntent
    data class LogWorkout(
        val workoutId: String?,
        val workoutName: String,
        val durationMinutes: Int,
        val notes: String?,
        val exerciseLogs: List<ExerciseLog>
    ) : WorkoutIntent
    
    // Session Draft Intents
    data class InitDraftFromWorkout(val workoutId: String) : WorkoutIntent
    data class UpdateSetActual(
        val exerciseIndex: Int,
        val setIndex: Int,
        val reps: Int?,
        val weight: Float?,
        val rpe: Int?
    ) : WorkoutIntent
    data class MarkSetComplete(val exerciseIndex: Int, val setIndex: Int, val completed: Boolean) : WorkoutIntent
    data class AddExtraSet(val exerciseIndex: Int) : WorkoutIntent
    data class RemoveSet(val exerciseIndex: Int, val setIndex: Int) : WorkoutIntent
    data class SubmitActiveSession(val durationMinutes: Int, val notes: String?) : WorkoutIntent

    data object DismissError : WorkoutIntent
    data object WorkoutLogged : WorkoutIntent
    data class SelectWorkoutLog(val logId: String) : WorkoutIntent
    data class AttachVideoToLog(val exerciseLogId: String, val videoBytes: ByteArray) : WorkoutIntent
}
