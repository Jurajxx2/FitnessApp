package com.coachfoska.app.domain.usecase.debug

import com.coachfoska.app.domain.repository.UserRepository

class ResetOnboardingUseCase(private val userRepository: UserRepository) {
    suspend operator fun invoke(userId: String): Result<Unit> =
        userRepository.resetOnboarding(userId)
}
