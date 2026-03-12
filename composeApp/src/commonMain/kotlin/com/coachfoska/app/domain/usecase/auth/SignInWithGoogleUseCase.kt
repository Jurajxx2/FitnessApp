package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.AuthRepository

class SignInWithGoogleUseCase(
    private val authRepository: AuthRepository,
    private val socialAuthProvider: SocialAuthProvider
) {
    suspend operator fun invoke(): Result<User> {
        val tokenResult = socialAuthProvider.getGoogleIdToken()
        val idToken = tokenResult.getOrElse { return Result.failure(it) }
        return authRepository.signInWithGoogleIdToken(idToken)
    }
}
