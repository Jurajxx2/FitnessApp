package com.coachfoska.app.auth

import com.coachfoska.app.domain.auth.AppleSignInCredential
import com.coachfoska.app.domain.auth.SocialAuthProvider

/**
 * iOS implementation of SocialAuthProvider.
 *
 * Apple Sign-In:
 * To implement, use platform.AuthenticationServices.ASAuthorizationAppleIDProvider
 * via Kotlin/Native interop. The full implementation requires:
 * 1. ASAuthorizationAppleIDProvider().createRequest()
 * 2. ASAuthorizationController with ASAuthorizationControllerDelegate
 * 3. Extract idToken and nonce from ASAuthorizationAppleIDCredential
 *
 * Google Sign-In on iOS:
 * For Google Sign-In on iOS, use Supabase's OAuth flow:
 * supabase.auth.signInWith(Google) — this opens a browser-based OAuth flow.
 * This is handled differently from Android's native credential manager approach.
 */
class IosSocialAuthProvider : SocialAuthProvider {

    override suspend fun getGoogleIdToken(): Result<String> =
        Result.failure(
            UnsupportedOperationException(
                "Google Sign-In on iOS uses OAuth browser flow via Supabase. " +
                    "Use supabase.auth.signInWith(Google) directly."
            )
        )

    override suspend fun getAppleCredential(): Result<AppleSignInCredential> =
        // TODO: Implement using ASAuthorizationAppleIDProvider
        // See class KDoc for implementation guide
        Result.failure(NotImplementedError("Apple Sign-In not yet implemented. See IosSocialAuthProvider KDoc."))
}
