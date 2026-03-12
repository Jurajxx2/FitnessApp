package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository

class SendOtpUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(email: String): Result<Unit> {
        if (email.isBlank() || !email.contains("@")) {
            return Result.failure(IllegalArgumentException("Invalid email address"))
        }
        return authRepository.sendEmailOtp(email.trim())
    }
}
