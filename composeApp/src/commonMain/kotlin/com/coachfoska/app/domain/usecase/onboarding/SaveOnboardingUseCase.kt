package com.coachfoska.app.domain.usecase.onboarding

import com.coachfoska.app.domain.model.OnboardingData
import com.coachfoska.app.domain.repository.OnboardingRepository

class SaveOnboardingUseCase(private val repository: OnboardingRepository) {
    suspend operator fun invoke(userId: String, data: OnboardingData): Result<Unit> =
        repository.saveResponses(userId, data)
}
