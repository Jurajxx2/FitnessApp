package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.AuthRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

// Singleton so every collector (Splash, App, etc.) reads from the same StateFlow
// instead of each one independently re-running getCurrentUser(). A single source of
// truth keeps the user id consistent across recompositions and avoids the race where
// one observer navigates before another has updated.
class ObserveSessionUseCase(
    authRepository: AuthRepository,
    scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
) {
    private val state: StateFlow<SessionAuthState> = authRepository.observeSessionStatus()
        .stateIn(scope, SharingStarted.Eagerly, SessionAuthState.Loading)

    operator fun invoke(): StateFlow<SessionAuthState> = state
}
