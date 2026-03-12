package com.coachfoska.app.presentation.auth

import com.coachfoska.app.domain.model.User

data class AuthState(
    val email: String = "",
    val otp: String = "",
    val isLoading: Boolean = false,
    val otpSent: Boolean = false,
    val error: String? = null,
    val authenticatedUser: User? = null,
    val navigateToHome: Boolean = false,
    val navigateToOnboarding: Boolean = false
)
