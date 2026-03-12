package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.UserRepository

class GetUserProfileUseCase(private val userRepository: UserRepository) {
    suspend operator fun invoke(userId: String): Result<User> =
        userRepository.getProfile(userId)
}
