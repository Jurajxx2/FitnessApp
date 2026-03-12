package com.coachfoska.app.presentation.auth

sealed interface AuthIntent {
    data class EmailChanged(val email: String) : AuthIntent
    data class OtpChanged(val otp: String) : AuthIntent
    data object SendOtp : AuthIntent
    data object VerifyOtp : AuthIntent
    data object SignInWithGoogle : AuthIntent
    data object SignInWithApple : AuthIntent
    data object DismissError : AuthIntent
    data object NavigatedToHome : AuthIntent
    data object NavigatedToOnboarding : AuthIntent
}
