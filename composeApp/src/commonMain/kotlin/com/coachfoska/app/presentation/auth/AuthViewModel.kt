package com.coachfoska.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.auth.GetCurrentUserUseCase
import com.coachfoska.app.domain.usecase.auth.SendOtpUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithAppleUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithGoogleUseCase
import com.coachfoska.app.domain.usecase.auth.VerifyOtpUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class AuthViewModel(
    private val sendOtpUseCase: SendOtpUseCase,
    private val verifyOtpUseCase: VerifyOtpUseCase,
    private val signInWithGoogleUseCase: SignInWithGoogleUseCase,
    private val signInWithAppleUseCase: SignInWithAppleUseCase,
    private val getCurrentUserUseCase: GetCurrentUserUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        checkCurrentSession()
    }

    fun onIntent(intent: AuthIntent) {
        when (intent) {
            is AuthIntent.EmailChanged -> _state.update { it.copy(email = intent.email, error = null) }
            is AuthIntent.OtpChanged -> _state.update { it.copy(otp = intent.otp, error = null) }
            is AuthIntent.SendOtp -> sendOtp()
            is AuthIntent.VerifyOtp -> verifyOtp()
            is AuthIntent.SignInWithGoogle -> signInWithGoogle()
            is AuthIntent.SignInWithApple -> signInWithApple()
            is AuthIntent.DismissError -> _state.update { it.copy(error = null) }
            is AuthIntent.NavigatedToHome -> _state.update { it.copy(navigateToHome = false) }
            is AuthIntent.NavigatedToOnboarding -> _state.update { it.copy(navigateToOnboarding = false) }
        }
    }

    private fun checkCurrentSession() {
        viewModelScope.launch {
            val user = getCurrentUserUseCase()
            if (user != null) {
                _state.update {
                    it.copy(
                        authenticatedUser = user,
                        navigateToHome = user.onboardingComplete,
                        navigateToOnboarding = !user.onboardingComplete
                    )
                }
            }
        }
    }

    private fun sendOtp() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            sendOtpUseCase(_state.value.email)
                .onSuccess { _state.update { it.copy(isLoading = false, otpSent = true) } }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to send OTP") } }
        }
    }

    private fun verifyOtp() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            verifyOtpUseCase(_state.value.email, _state.value.otp)
                .onSuccess { user ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            authenticatedUser = user,
                            navigateToHome = user.onboardingComplete,
                            navigateToOnboarding = !user.onboardingComplete
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message ?: "Invalid OTP") } }
        }
    }

    private fun signInWithGoogle() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            signInWithGoogleUseCase()
                .onSuccess { user ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            authenticatedUser = user,
                            navigateToHome = user.onboardingComplete,
                            navigateToOnboarding = !user.onboardingComplete
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message ?: "Google sign-in failed") } }
        }
    }

    private fun signInWithApple() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            signInWithAppleUseCase()
                .onSuccess { user ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            authenticatedUser = user,
                            navigateToHome = user.onboardingComplete,
                            navigateToOnboarding = !user.onboardingComplete
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message ?: "Apple sign-in failed") } }
        }
    }
}
