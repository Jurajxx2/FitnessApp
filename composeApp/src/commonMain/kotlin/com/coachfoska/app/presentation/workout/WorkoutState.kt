package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog

data class WorkoutState(
    val workouts: List<Workout> = emptyList(),
    val workoutHistory: List<WorkoutLog> = emptyList(),
    val activityHistory: List<GeneralActivityLog> = emptyList(),
    val selectedWorkout: Workout? = null,
    val selectedWorkoutLog: WorkoutLog? = null,
    val isLoading: Boolean = false,
    val isHistoryLoading: Boolean = false,
    val isLogging: Boolean = false,
    val workoutLoggedSuccess: Boolean = false,
    val error: String? = null
)
