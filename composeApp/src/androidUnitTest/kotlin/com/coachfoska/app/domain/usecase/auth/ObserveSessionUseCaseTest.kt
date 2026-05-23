package com.coachfoska.app.domain.usecase.auth

import app.cash.turbine.test
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.fixtures.aUser
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertSame

@OptIn(ExperimentalCoroutinesApi::class)
class ObserveSessionUseCaseTest {

    private val authRepository = mockk<AuthRepository>()

    @Test
    fun `seeds Loading and updates as repo emits`() = runTest(UnconfinedTestDispatcher()) {
        val user = aUser()
        val upstream = MutableSharedFlow<SessionAuthState>(replay = 0)
        every { authRepository.observeSessionStatus() } returns upstream

        val useCase = ObserveSessionUseCase(authRepository, backgroundScope)

        useCase().test {
            assertEquals(SessionAuthState.Loading, awaitItem())
            upstream.emit(SessionAuthState.Authenticated(user))
            assertEquals(SessionAuthState.Authenticated(user), awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emits NotAuthenticated when repo emits NotAuthenticated`() = runTest(UnconfinedTestDispatcher()) {
        every { authRepository.observeSessionStatus() } returns flowOf(SessionAuthState.NotAuthenticated)

        val useCase = ObserveSessionUseCase(authRepository, backgroundScope)

        useCase().test {
            assertEquals(SessionAuthState.NotAuthenticated, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `shares state across collectors (single source of truth)`() = runTest(UnconfinedTestDispatcher()) {
        val upstream = MutableSharedFlow<SessionAuthState>(replay = 0)
        every { authRepository.observeSessionStatus() } returns upstream

        val useCase = ObserveSessionUseCase(authRepository, backgroundScope)

        // Same StateFlow returned on every invocation — no duplicate upstream collection.
        assertSame(useCase(), useCase())
    }
}
