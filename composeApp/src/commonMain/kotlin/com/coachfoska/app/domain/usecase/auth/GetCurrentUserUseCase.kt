package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.AuthRepository

class GetCurrentUserUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(): User? = authRepository.getCurrentUser()
}
