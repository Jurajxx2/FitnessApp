package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.repository.UserRepository

class UpdateUserProfileUseCase(private val userRepository: UserRepository) {
    suspend operator fun invoke(
        userId: String,
        fullName: String? = null,
        age: Int? = null,
        heightCm: Float? = null,
        weightKg: Float? = null,
        goal: UserGoal? = null,
        activityLevel: ActivityLevel? = null
    ): Result<User> = userRepository.updateProfile(
        userId, fullName, age, heightCm, weightKg, goal, activityLevel
    )
}
