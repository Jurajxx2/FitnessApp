package com.coachfoska.app.domain.model

sealed interface SessionAuthState {
    data object Loading : SessionAuthState
    data class Authenticated(val user: User) : SessionAuthState
    data object NotAuthenticated : SessionAuthState
}
