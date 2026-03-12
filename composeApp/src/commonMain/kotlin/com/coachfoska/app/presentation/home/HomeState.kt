package com.coachfoska.app.presentation.home

import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.Workout

data class HomeState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val todayWorkout: Workout? = null,
    val nutritionSummary: DailyNutritionSummary? = null,
    val error: String? = null
)
