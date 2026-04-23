package com.coachfoska.app.presentation.splash

import app.cash.turbine.test
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import com.coachfoska.app.fixtures.aUser
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

@OptIn(ExperimentalCoroutinesApi::class)
class SplashViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val authRepository: AuthRepository = mockk()
    private val deviceTokenRepository: DeviceTokenRepository = mockk()

    private fun viewModel() = SplashViewModel(
        observeSession = ObserveSessionUseCase(authRepository),
        deviceTokenRepository = deviceTokenRepository
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `state is NavigateToHome when authenticated user has completed onboarding`() = runTest {
        val user = aUser(onboardingComplete = true)
        val sessionFlow = MutableStateFlow<SessionAuthState>(SessionAuthState.Authenticated(user))
        every { authRepository.observeSessionStatus() } returns sessionFlow
        coEvery { deviceTokenRepository.upsertToken(any()) } returns Result.success(Unit)

        viewModel().state.test {
            val item = awaitItem()
            assertIs<SplashNavState.NavigateToHome>(item)
            assertEquals("user-1", item.userId)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `state is NavigateToOnboarding when authenticated user has not completed onboarding`() = runTest {
        val user = aUser(onboardingComplete = false)
        val sessionFlow = MutableStateFlow<SessionAuthState>(SessionAuthState.Authenticated(user))
        every { authRepository.observeSessionStatus() } returns sessionFlow
        coEvery { deviceTokenRepository.upsertToken(any()) } returns Result.success(Unit)

        viewModel().state.test {
            val item = awaitItem()
            assertIs<SplashNavState.NavigateToOnboarding>(item)
            assertEquals("user-1", item.userId)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `state is NavigateToWelcome when not authenticated`() = runTest {
        val sessionFlow = MutableStateFlow<SessionAuthState>(SessionAuthState.NotAuthenticated)
        every { authRepository.observeSessionStatus() } returns sessionFlow

        viewModel().state.test {
            assertIs<SplashNavState.NavigateToWelcome>(awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `initial state is Loading`() = runTest {
        every { authRepository.observeSessionStatus() } returns flowOf()

        viewModel().state.test {
            assertIs<SplashNavState.Loading>(awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }
}
