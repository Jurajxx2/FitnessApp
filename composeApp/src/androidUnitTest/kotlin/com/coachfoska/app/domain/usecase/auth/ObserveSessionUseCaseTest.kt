package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.fixtures.aUser
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import app.cash.turbine.test
import kotlin.test.Test
import kotlin.test.assertEquals

class ObserveSessionUseCaseTest {

    private val authRepository = mockk<AuthRepository>()
    private val useCase = ObserveSessionUseCase(authRepository)

    @Test
    fun `delegates to repo and emits Loading then Authenticated`() = runTest {
        val user = aUser()
        val states = listOf(SessionAuthState.Loading, SessionAuthState.Authenticated(user))
        every { authRepository.observeSessionStatus() } returns flowOf(*states.toTypedArray())

        useCase().test {
            assertEquals(SessionAuthState.Loading, awaitItem())
            assertEquals(SessionAuthState.Authenticated(user), awaitItem())
            awaitComplete()
        }
    }

    @Test
    fun `emits NotAuthenticated when not signed in`() = runTest {
        every { authRepository.observeSessionStatus() } returns flowOf(SessionAuthState.NotAuthenticated)

        useCase().test {
            assertEquals(SessionAuthState.NotAuthenticated, awaitItem())
            awaitComplete()
        }
    }
}
