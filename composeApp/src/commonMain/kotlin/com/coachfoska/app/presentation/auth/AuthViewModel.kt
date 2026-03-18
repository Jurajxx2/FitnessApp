package com.coachfoska.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.auth.SendOtpUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithAppleUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithGoogleUseCase
import com.coachfoska.app.domain.usecase.auth.VerifyOtpUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "AuthViewModel"

class AuthViewModel(
    private val sendOtpUseCase: SendOtpUseCase,
    private val verifyOtpUseCase: VerifyOtpUseCase,
    private val signInWithGoogleUseCase: SignInWithGoogleUseCase,
    private val signInWithAppleUseCase: SignInWithAppleUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    fun onIntent(intent: AuthIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
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
            is AuthIntent.NavigatedToVerifyOtp -> _state.update { it.copy(otpSent = false) }
        }
    }

    private fun sendOtp() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            sendOtpUseCase(_state.value.email)
                .onSuccess {
                    Napier.i("OTP sent", tag = TAG)
                    _state.update { it.copy(isLoading = false, otpSent = true) }
                }
                .onFailure { e ->
                    Napier.e("sendOtp failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message ?: "Failed to send OTP") }
                }
        }
    }

    private fun verifyOtp() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            verifyOtpUseCase(_state.value.email, _state.value.otp)
                .onSuccess { user ->
                    Napier.i("OTP verified, userId=${user.id}", tag = TAG)
                    _state.update {
                        it.copy(
                            isLoading = false,
                            authenticatedUser = user,
                            navigateToHome = user.onboardingComplete,
                            navigateToOnboarding = !user.onboardingComplete
                        )
                    }
                }
                .onFailure { e ->
                    Napier.e("verifyOtp failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message ?: "Invalid OTP") }
                }
        }
    }

    private fun signInWithGoogle() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            signInWithGoogleUseCase()
                .onSuccess { user ->
                    Napier.i("Google sign-in OK, userId=${user.id}", tag = TAG)
                    _state.update {
                        it.copy(
                            isLoading = false,
                            authenticatedUser = user,
                            navigateToHome = user.onboardingComplete,
                            navigateToOnboarding = !user.onboardingComplete
                        )
                    }
                }
                .onFailure { e ->
                    Napier.e("Google sign-in failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message ?: "Google sign-in failed") }
                }
        }
    }

    private fun signInWithApple() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            signInWithAppleUseCase()
                .onSuccess { user ->
                    Napier.i("Apple sign-in OK, userId=${user.id}", tag = TAG)
                    _state.update {
                        it.copy(
                            isLoading = false,
                            authenticatedUser = user,
                            navigateToHome = user.onboardingComplete,
                            navigateToOnboarding = !user.onboardingComplete
                        )
                    }
                }
                .onFailure { e ->
                    Napier.e("Apple sign-in failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message ?: "Apple sign-in failed") }
                }
        }
    }
}
