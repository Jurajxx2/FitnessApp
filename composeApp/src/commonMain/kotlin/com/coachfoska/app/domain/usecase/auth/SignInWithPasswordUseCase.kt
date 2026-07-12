package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.AuthRepository

class SignInWithPasswordUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(email: String, password: String): Result<User> {
        val normalizedEmail = email.trim().lowercase()
        if (normalizedEmail.isBlank() || !normalizedEmail.contains("@")) {
            return Result.failure(IllegalArgumentException("Invalid email address"))
        }
        if (password.isBlank()) {
            return Result.failure(IllegalArgumentException("Password is required"))
        }
        return authRepository.signInWithEmailPassword(normalizedEmail, password)
    }
}
