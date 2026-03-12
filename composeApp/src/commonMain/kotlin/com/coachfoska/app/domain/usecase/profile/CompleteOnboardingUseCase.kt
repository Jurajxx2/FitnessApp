package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.repository.UserRepository

class CompleteOnboardingUseCase(private val userRepository: UserRepository) {
    suspend operator fun invoke(
        userId: String,
        goal: UserGoal,
        heightCm: Float,
        weightKg: Float,
        age: Int,
        activityLevel: ActivityLevel
    ): Result<Unit> = userRepository.completeOnboarding(
        userId, goal, heightCm, weightKg, age, activityLevel
    )
}
