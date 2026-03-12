package com.coachfoska.app.data.remote.datasource

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.Apple
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.auth.user.UserInfo

class AuthRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun sendEmailOtp(email: String) {
        supabase.auth.signInWith(OTP) {
            this.email = email
            createUser = true
        }
    }

    suspend fun verifyEmailOtp(email: String, token: String): UserInfo {
        supabase.auth.verifyEmailOtp(type = OtpType.Email.EMAIL, email = email, token = token)
        return supabase.auth.currentUserOrNull()
            ?: throw IllegalStateException("User not found after OTP verification")
    }

    suspend fun signInWithGoogleIdToken(idToken: String): UserInfo {
        supabase.auth.signInWith(IDToken) {
            this.idToken = idToken
            provider = Google
        }
        return supabase.auth.currentUserOrNull()
            ?: throw IllegalStateException("User not found after Google sign-in")
    }

    suspend fun signInWithApple(idToken: String, nonce: String): UserInfo {
        supabase.auth.signInWith(IDToken) {
            this.idToken = idToken
            this.nonce = nonce
            provider = Apple
        }
        return supabase.auth.currentUserOrNull()
            ?: throw IllegalStateException("User not found after Apple sign-in")
    }

    suspend fun signOut() {
        supabase.auth.signOut()
    }

    fun getCurrentUserInfo(): UserInfo? = supabase.auth.currentUserOrNull()
}
