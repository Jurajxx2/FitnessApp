package com.coachfoska.app.data.remote.datasource

import io.github.aakira.napier.Napier
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.providers.Apple
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.auth.user.UserInfo
import io.ktor.client.HttpClient
import kotlinx.serialization.Serializable

@Serializable
private data class OtpRequest(val email: String, val create_user: Boolean = true)

class AuthRemoteDataSource(
    private val supabase: SupabaseClient,
    private val httpClient: HttpClient
) {

    suspend fun sendEmailOtp(email: String): Result<Unit> {
        /*httpClient.post("${supabase.supabaseUrl}/auth/v1/otp") {
            header("apikey", supabase.supabaseKey)
            header("Authorization", "Bearer ${supabase.supabaseKey}")
            contentType(ContentType.Application.Json)
            setBody(OtpRequest(email = email))
        }*/
        return try {
            Napier.d { "COACHX: sending sign in with OTP start" }
            supabase.auth.signInWith(OTP) {
                this.email = email
            }
            Napier.d { "COACHX: sending sign in with OTP success" }
            Result.success(Unit)
        } catch (e: Exception) {
            Napier.d { "COACHX: sending sign in with OTP error" }
            Result.failure(e)
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

    fun sessionStatusFlow() = supabase.auth.sessionStatus
}
