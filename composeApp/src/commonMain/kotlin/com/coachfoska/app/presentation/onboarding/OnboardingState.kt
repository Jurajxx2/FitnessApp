package com.coachfoska.app.presentation.onboarding

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal

data class OnboardingState(
    val selectedGoal: UserGoal? = null,
    val heightInput: String = "",
    val weightInput: String = "",
    val ageInput: String = "",
    val selectedActivityLevel: ActivityLevel? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val onboardingComplete: Boolean = false
)
