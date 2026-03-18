package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.model.User
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    /** Returns the current signed-in user, or null if not authenticated. */
    suspend fun getCurrentUser(): User?

    /** Send an OTP to the given email address. */
    suspend fun sendEmailOtp(email: String): Result<Unit>

    /** Verify the OTP received by email. Returns the signed-in user. */
    suspend fun verifyEmailOtp(email: String, otp: String): Result<User>

    /** Sign in using a Google ID token (Android). */
    suspend fun signInWithGoogleIdToken(idToken: String): Result<User>

    /** Sign in using Apple credentials (iOS). */
    suspend fun signInWithApple(idToken: String, nonce: String): Result<User>

    /** Sign out the current user. */
    suspend fun signOut(): Result<Unit>

    /** Whether the user has completed onboarding. */
    suspend fun hasCompletedOnboarding(): Boolean

    /** Emits session state as it changes (Loading → Authenticated/NotAuthenticated). */
    fun observeSessionStatus(): Flow<SessionAuthState>
}
