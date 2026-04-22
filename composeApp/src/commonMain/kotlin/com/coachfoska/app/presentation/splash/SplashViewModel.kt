package com.coachfoska.app.presentation.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.launch

private const val TAG = "SplashViewModel"

sealed interface SplashNavState {
    data object Loading : SplashNavState
    data class NavigateToHome(val userId: String) : SplashNavState
    data class NavigateToOnboarding(val userId: String) : SplashNavState
    data object NavigateToWelcome : SplashNavState
}

class SplashViewModel(
    private val observeSession: ObserveSessionUseCase,
    private val deviceTokenRepository: DeviceTokenRepository
) : ViewModel() {

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

    init {
        viewModelScope.launch {
            observeSession()
                .filterIsInstance<SessionAuthState.Authenticated>()
                .take(1)
                .collect { authState ->
                    deviceTokenRepository.upsertToken(authState.user.id)
                        .onFailure { e -> Napier.e("Token upsert failed", e, tag = TAG) }
                }
        }
    }
}
