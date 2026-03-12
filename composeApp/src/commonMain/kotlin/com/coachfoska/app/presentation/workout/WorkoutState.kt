package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog

data class WorkoutState(
    val isLoading: Boolean = false,
    val workouts: List<Workout> = emptyList(),
    val selectedWorkout: Workout? = null,
    val workoutHistory: List<WorkoutLog> = emptyList(),
    val isHistoryLoading: Boolean = false,
    val isLogging: Boolean = false,
    val workoutLoggedSuccess: Boolean = false,
    val error: String? = null
)
