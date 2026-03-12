package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.AuthRepository

class VerifyOtpUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(email: String, otp: String): Result<User> {
        if (otp.length != 6 || !otp.all { it.isDigit() }) {
            return Result.failure(IllegalArgumentException("OTP must be 6 digits"))
        }
        return authRepository.verifyEmailOtp(email, otp)
    }
}
