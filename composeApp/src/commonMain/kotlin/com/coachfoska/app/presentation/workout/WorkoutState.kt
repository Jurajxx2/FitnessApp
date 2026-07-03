package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import kotlinx.datetime.Instant

data class WorkoutState(
    val workouts: List<Workout> = emptyList(),
    val allWorkouts: List<Workout> = emptyList(),
    val workoutHistory: List<WorkoutLog> = emptyList(),
    val inProgressSession: WorkoutLog? = null,
    /** Maps workoutId → most-recent loggedAt instant, derived from workoutHistory. */
    val lastPerformedByWorkoutId: Map<String, Instant> = emptyMap(),
    val selectedWorkout: Workout? = null,
    val selectedWorkoutLog: WorkoutLog? = null,
    val sessionDraft: SessionDraft? = null,
    /** (oldName, newName) after a plan-forward substitution. */
    val lastPlanSubstitution: Pair<String, String>? = null,
    val isLoading: Boolean = false,
    val isHistoryLoading: Boolean = false,
    val isLogging: Boolean = false,
    val workoutLoggedSuccess: Boolean = false,
    val error: String? = null
)
