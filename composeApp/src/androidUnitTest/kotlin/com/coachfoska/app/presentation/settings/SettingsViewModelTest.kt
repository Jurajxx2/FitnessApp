package com.coachfoska.app.presentation.settings

import com.coachfoska.app.core.debug.DebugCoachSubscriptionRepository
import com.coachfoska.app.domain.model.AppLinks
import com.coachfoska.app.domain.repository.AppConfigRepository
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.auth.GetCurrentUserUseCase
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import com.coachfoska.app.domain.usecase.debug.ResetOnboardingUseCase
import com.coachfoska.app.fixtures.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.verify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val appConfigRepository: AppConfigRepository = mockk()
    private val authRepository: AuthRepository = mockk()
    private val userRepository: UserRepository = mockk()
    private val debugCoachSubscriptionRepository: DebugCoachSubscriptionRepository = mockk()
    private val coachSubscribed = MutableStateFlow(true)

    private fun viewModel() = SettingsViewModel(
        getAppLinksUseCase = GetAppLinksUseCase(appConfigRepository),
        getCurrentUserUseCase = GetCurrentUserUseCase(authRepository),
        resetOnboardingUseCase = ResetOnboardingUseCase(userRepository),
        debugCoachSubscriptionRepository = debugCoachSubscriptionRepository,
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coachSubscribed.value = true
        every { debugCoachSubscriptionRepository.isCoachSubscribed } returns coachSubscribed
        every { debugCoachSubscriptionRepository.setCoachSubscribed(any()) } returns Unit
    }
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    private fun stubLinksSuccess() {
        coEvery { appConfigRepository.getAppLinks() } returns Result.success(
            AppLinks("https://p", "https://t", "https://d")
        )
    }

    @Test
    fun `init loads links into state`() = runTest {
        stubLinksSuccess()

        val vm = viewModel()

        assertEquals("https://p", vm.state.value.privacyPolicyUrl)
        assertEquals("https://t", vm.state.value.termsOfServiceUrl)
        assertEquals("https://d", vm.state.value.accountDeletionUrl)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `init observes debug coach subscription state`() = runTest {
        stubLinksSuccess()
        coachSubscribed.value = false

        val vm = viewModel()

        assertFalse(vm.state.value.debugCoachSubscribed)
    }

    @Test
    fun `debugSetCoachSubscribed delegates to repository`() = runTest {
        stubLinksSuccess()
        val vm = viewModel()

        vm.debugSetCoachSubscribed(false)

        verify(exactly = 1) { debugCoachSubscriptionRepository.setCoachSubscribed(false) }
    }

    @Test
    fun `init sets error when links load fails`() = runTest {
        coEvery { appConfigRepository.getAppLinks() } returns Result.failure(RuntimeException("net"))

        val vm = viewModel()

        assertEquals("net", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `debugResetOnboarding success sets success flag`() = runTest {
        stubLinksSuccess()
        coEvery { authRepository.getCurrentUser() } returns aUser(id = "user-1")
        coEvery { userRepository.resetOnboarding("user-1") } returns Result.success(Unit)
        val vm = viewModel()

        vm.debugResetOnboarding()

        assertTrue(vm.state.value.debugResetOnboardingSuccess)
        assertFalse(vm.state.value.debugResetOnboardingLoading)
    }

    @Test
    fun `debugResetOnboarding with no user sets error and does not call reset`() = runTest {
        stubLinksSuccess()
        coEvery { authRepository.getCurrentUser() } returns null
        val vm = viewModel()

        vm.debugResetOnboarding()

        assertEquals("No authenticated user", vm.state.value.error)
        assertFalse(vm.state.value.debugResetOnboardingSuccess)
        assertFalse(vm.state.value.debugResetOnboardingLoading)
        coVerify(exactly = 0) { userRepository.resetOnboarding(any()) }
    }

    @Test
    fun `debugResetOnboarding failure sets error`() = runTest {
        stubLinksSuccess()
        coEvery { authRepository.getCurrentUser() } returns aUser(id = "user-1")
        coEvery { userRepository.resetOnboarding("user-1") } returns Result.failure(RuntimeException("reset failed"))
        val vm = viewModel()

        vm.debugResetOnboarding()

        assertEquals("reset failed", vm.state.value.error)
        assertFalse(vm.state.value.debugResetOnboardingSuccess)
    }
}
