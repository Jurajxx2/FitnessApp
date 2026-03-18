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

    override suspend fun getCurrentUser(): User? {
        val userInfo = authDataSource.getCurrentUserInfo() ?: return null
        return runCatching { userDataSource.getProfile(userInfo.id).toDomain() }.getOrNull()
            ?: User(
                id = userInfo.id,
                email = userInfo.email ?: "",
                fullName = null,
                age = null,
                heightCm = null,
                weightKg = null,
                goal = null,
                activityLevel = null,
                onboardingComplete = false
            )
    }

    override suspend fun sendEmailOtp(email: String): Result<Unit> =
        authDataSource.sendEmailOtp(email)

    override suspend fun verifyEmailOtp(email: String, otp: String): Result<User> = runCatching {
        val userInfo = authDataSource.verifyEmailOtp(email, otp)
        runCatching { userDataSource.getProfile(userInfo.id).toDomain() }.getOrElse {
            User(
                id = userInfo.id,
                email = userInfo.email ?: email,
                fullName = null,
                age = null,
                heightCm = null,
                weightKg = null,
                goal = null,
                activityLevel = null,
                onboardingComplete = false
            )
        }
    }

    override suspend fun signInWithGoogleIdToken(idToken: String): Result<User> = runCatching {
        val userInfo = authDataSource.signInWithGoogleIdToken(idToken)
        runCatching { userDataSource.getProfile(userInfo.id).toDomain() }.getOrElse {
            User(
                id = userInfo.id,
                email = userInfo.email ?: "",
                fullName = null,
                age = null,
                heightCm = null,
                weightKg = null,
                goal = null,
                activityLevel = null,
                onboardingComplete = false
            )
        }
    }

    override suspend fun signInWithApple(idToken: String, nonce: String): Result<User> = runCatching {
        val userInfo = authDataSource.signInWithApple(idToken, nonce)
        runCatching { userDataSource.getProfile(userInfo.id).toDomain() }.getOrElse {
            User(
                id = userInfo.id,
                email = userInfo.email ?: "",
                fullName = null,
                age = null,
                heightCm = null,
                weightKg = null,
                goal = null,
                activityLevel = null,
                onboardingComplete = false
            )
        }
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
