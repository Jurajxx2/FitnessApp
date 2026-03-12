package com.coachfoska.app.domain.auth

/**
 * Platform-specific implementation providing social auth credentials.
 * Injected via Koin from androidMain / iosMain.
 */
interface SocialAuthProvider {
    /**
     * Triggers Google Sign-In and returns the Google ID token.
     * Only meaningful on Android; returns Result.failure on iOS.
     */
    suspend fun getGoogleIdToken(): Result<String>

    /**
     * Triggers Apple Sign-In and returns the credential.
     * Only meaningful on iOS; returns Result.failure on Android.
     */
    suspend fun getAppleCredential(): Result<AppleSignInCredential>
}

data class AppleSignInCredential(
    val idToken: String,
    val nonce: String,
    val fullName: String? = null,
    val email: String? = null
)
