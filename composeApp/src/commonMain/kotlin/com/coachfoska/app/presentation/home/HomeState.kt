package com.coachfoska.app.presentation.home

import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog

data class HomeState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val todayWorkout: Workout? = null,
    val workouts: List<Workout> = emptyList(),
    val workoutHistory: List<WorkoutLog> = emptyList(),
    val nutritionSummary: DailyNutritionSummary? = null,
    val macroTargets: MacroTargets? = null,
    val lastCoachMessage: ChatMessage? = null,
    val hasUnreadCoachMessage: Boolean = false,
    val waterConsumedMl: Int = 0,
    val waterGoalMl: Int = 2000,
    val quickAddVolumeMl: Int = 250,
    val error: String? = null
)
