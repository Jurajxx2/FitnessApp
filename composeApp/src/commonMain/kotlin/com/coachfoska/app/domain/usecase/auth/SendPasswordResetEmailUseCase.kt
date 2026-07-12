package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository

class SendPasswordResetEmailUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(email: String): Result<Unit> {
        val normalizedEmail = email.trim().lowercase()
        if (normalizedEmail.isBlank() || !normalizedEmail.contains("@")) {
            return Result.failure(IllegalArgumentException("Invalid email address"))
        }
        return authRepository.sendPasswordResetEmail(normalizedEmail)
    }
}
