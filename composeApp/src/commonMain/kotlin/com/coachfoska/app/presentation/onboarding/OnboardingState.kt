package com.coachfoska.app.presentation.onboarding

import com.coachfoska.app.domain.model.OnboardingData

data class OnboardingState(
    val currentStep: Int = 0,
    val data: OnboardingData = OnboardingData(),
    val isSaving: Boolean = false,
    val error: String? = null,
    val isCompleted: Boolean = false
) {
    val currentStepEnum: OnboardingStep
        get() = OnboardingStep.entries[currentStep.coerceIn(0, OnboardingStep.entries.size - 1)]

    /** 0f..1f progress across all steps (used by the top progress bar). */
    val progress: Float
        get() = currentStep.toFloat() / (OnboardingStep.entries.size - 1).toFloat()
}
