package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.AuthRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.AuthRepository
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.transform

class AuthRepositoryImpl(
    private val authDataSource: AuthRemoteDataSource,
    private val userDataSource: UserRemoteDataSource
) : AuthRepository {

    private suspend fun resolveSignedInUser(userId: String, email: String): User {
        val user = runCatching { userDataSource.getProfile(userId).toDomain() }.getOrElse {
            User(
                id = userId,
                email = email,
                fullName = null,
                age = null,
                heightCm = null,
                weightKg = null,
                goal = null,
                activityLevel = null,
                onboardingComplete = false
            )
        }

        if (user.isBlocked) {
            runCatching { authDataSource.signOut() }
            error("This account has been blocked. Contact your coach.")
        }
        return user
    }

    override suspend fun getCurrentUser(): User? {
        val userInfo = authDataSource.getCurrentUserInfo() ?: return null
        return runCatching { resolveSignedInUser(userInfo.id, userInfo.email ?: "") }.getOrNull()
    }

    override suspend fun sendEmailOtp(email: String): Result<Unit> =
        authDataSource.sendEmailOtp(email)

    override suspend fun verifyEmailOtp(email: String, otp: String): Result<User> = runCatching {
        val userInfo = authDataSource.verifyEmailOtp(email, otp)
        resolveSignedInUser(userInfo.id, userInfo.email ?: email)
    }

    override suspend fun signInWithEmailPassword(email: String, password: String): Result<User> = runCatching {
        val userInfo = authDataSource.signInWithEmailPassword(email, password)
        resolveSignedInUser(userInfo.id, userInfo.email ?: email)
    }

    override suspend fun sendPasswordResetEmail(email: String): Result<Unit> = runCatching {
        authDataSource.sendPasswordResetEmail(email)
    }

    override suspend fun signInWithGoogleIdToken(idToken: String): Result<User> = runCatching {
        val userInfo = authDataSource.signInWithGoogleIdToken(idToken)
        resolveSignedInUser(userInfo.id, userInfo.email ?: "")
    }

    override suspend fun signInWithApple(idToken: String, nonce: String): Result<User> = runCatching {
        val userInfo = authDataSource.signInWithApple(idToken, nonce)
        resolveSignedInUser(userInfo.id, userInfo.email ?: "")
    }

    override suspend fun signOut(): Result<Unit> = runCatching {
        authDataSource.signOut()
    }

    override fun observeSessionStatus(): Flow<SessionAuthState> =
        authDataSource.sessionStatusFlow().transform { status ->
            when (status) {
                is SessionStatus.Initializing -> emit(SessionAuthState.Loading)
                is SessionStatus.Authenticated -> {
                    val user = getCurrentUser()
                    emit(
                        if (user != null) SessionAuthState.Authenticated(user)
                        else SessionAuthState.NotAuthenticated
                    )
                }
                else -> emit(SessionAuthState.NotAuthenticated)
            }
        }

    override suspend fun hasCompletedOnboarding(): Boolean {
        val userInfo = authDataSource.getCurrentUserInfo() ?: return false
        return runCatching {
            userDataSource.getProfile(userInfo.id).onboardingComplete
        }.getOrElse { false }
    }
}
