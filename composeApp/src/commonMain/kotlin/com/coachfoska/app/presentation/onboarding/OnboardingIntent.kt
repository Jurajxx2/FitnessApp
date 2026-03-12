package com.coachfoska.app.presentation.onboarding

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal

sealed interface OnboardingIntent {
    data class GoalSelected(val goal: UserGoal) : OnboardingIntent
    data class HeightChanged(val height: String) : OnboardingIntent
    data class WeightChanged(val weight: String) : OnboardingIntent
    data class AgeChanged(val age: String) : OnboardingIntent
    data class ActivityLevelSelected(val level: ActivityLevel) : OnboardingIntent
    data object CompleteOnboarding : OnboardingIntent
    data object DismissError : OnboardingIntent
    data object NavigatedToHome : OnboardingIntent
}
