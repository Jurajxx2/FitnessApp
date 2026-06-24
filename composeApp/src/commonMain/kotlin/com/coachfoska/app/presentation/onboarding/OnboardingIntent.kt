package com.coachfoska.app.presentation.onboarding

import com.coachfoska.app.domain.model.Equipment
import com.coachfoska.app.domain.model.ExperienceLevel
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.Gender
import com.coachfoska.app.domain.model.MuscleGroup
import com.coachfoska.app.domain.model.TrainingPreference
import kotlinx.datetime.DayOfWeek

sealed interface OnboardingIntent {
    data class SelectGender(val gender: Gender) : OnboardingIntent
    data class SelectGoal(val goal: FitnessGoal) : OnboardingIntent
    data class SelectExperience(val level: ExperienceLevel) : OnboardingIntent
    data class ToggleFocusArea(val area: MuscleGroup) : OnboardingIntent
    data class ToggleTrainingDay(val day: DayOfWeek) : OnboardingIntent
    data class SetNotificationsEnabled(val enabled: Boolean) : OnboardingIntent
    data class SelectEquipment(val equipment: Equipment) : OnboardingIntent
    data class SetAge(val age: Int) : OnboardingIntent
    data class SetHeight(val cm: Int) : OnboardingIntent
    data class SetWeight(val kg: Float) : OnboardingIntent
    data class ToggleMetric(val metric: Boolean) : OnboardingIntent
    data class SelectTrainingPreference(val pref: TrainingPreference) : OnboardingIntent
    data class SetName(val name: String) : OnboardingIntent
    data object NextStep : OnboardingIntent
    data object PreviousStep : OnboardingIntent
    data object CompleteOnboarding : OnboardingIntent
}
