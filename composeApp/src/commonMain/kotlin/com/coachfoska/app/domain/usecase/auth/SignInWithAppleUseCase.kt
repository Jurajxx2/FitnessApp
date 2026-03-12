package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.AuthRepository

class SignInWithAppleUseCase(
    private val authRepository: AuthRepository,
    private val socialAuthProvider: SocialAuthProvider
) {
    suspend operator fun invoke(): Result<User> {
        val credResult = socialAuthProvider.getAppleCredential()
        val cred = credResult.getOrElse { return Result.failure(it) }
        return authRepository.signInWithApple(cred.idToken, cred.nonce)
    }
}
