package com.coachfoska.app.presentation.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

sealed interface SplashNavState {
    data object Loading : SplashNavState
    data class NavigateToHome(val userId: String) : SplashNavState
    data class NavigateToOnboarding(val userId: String) : SplashNavState
    data object NavigateToWelcome : SplashNavState
}

class SplashViewModel(observeSession: ObserveSessionUseCase) : ViewModel() {

    val state: StateFlow<SplashNavState> = observeSession()
        .map { sessionState ->
            when (sessionState) {
                SessionAuthState.Loading -> SplashNavState.Loading
                is SessionAuthState.Authenticated -> {
                    val user = sessionState.user
                    if (user.onboardingComplete) SplashNavState.NavigateToHome(user.id)
                    else SplashNavState.NavigateToOnboarding(user.id)
                }
                SessionAuthState.NotAuthenticated -> SplashNavState.NavigateToWelcome
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SplashNavState.Loading)
}
