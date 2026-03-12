package com.coachfoska.app.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.domain.auth.AppleSignInCredential
import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

class AndroidSocialAuthProvider(private val context: Context) : SocialAuthProvider {

    private val credentialManager = CredentialManager.create(context)

    override suspend fun getGoogleIdToken(): Result<String> = runCatching {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(BuildKonfig.GOOGLE_WEB_CLIENT_ID)
            .setAutoSelectEnabled(true)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val result = credentialManager.getCredential(context, request)
        val credential = result.credential

        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            GoogleIdTokenCredential.createFrom(credential.data).idToken
        } else {
            throw IllegalStateException("Unexpected credential type: ${credential.type}")
        }
    }

    override suspend fun getAppleCredential(): Result<AppleSignInCredential> =
        Result.failure(UnsupportedOperationException("Apple Sign-In is not available on Android"))
}
