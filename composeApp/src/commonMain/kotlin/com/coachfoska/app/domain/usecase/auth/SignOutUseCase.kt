package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository

class SignOutUseCase(private val authRepository: AuthRepository) {
    suspend operator fun invoke(): Result<Unit> = authRepository.signOut()
}
