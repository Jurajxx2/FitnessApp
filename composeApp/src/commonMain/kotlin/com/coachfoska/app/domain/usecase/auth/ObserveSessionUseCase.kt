package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.AuthRepository
import kotlinx.coroutines.flow.Flow

class ObserveSessionUseCase(private val authRepository: AuthRepository) {
    operator fun invoke(): Flow<SessionAuthState> = authRepository.observeSessionStatus()
}
