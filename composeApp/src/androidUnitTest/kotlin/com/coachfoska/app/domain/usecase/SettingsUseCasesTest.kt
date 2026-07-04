package com.coachfoska.app.domain.usecase

import com.coachfoska.app.domain.model.AppLinks
import com.coachfoska.app.domain.repository.AppConfigRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import com.coachfoska.app.domain.usecase.debug.ResetOnboardingUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SettingsUseCasesTest {

    private val appConfigRepository: AppConfigRepository = mockk()
    private val userRepository: UserRepository = mockk()

    @Test
    fun `getAppLinks delegates to repository`() = runTest {
        val links = AppLinks("https://p", "https://t", "https://d")
        coEvery { appConfigRepository.getAppLinks() } returns Result.success(links)

        val result = GetAppLinksUseCase(appConfigRepository)()

        assertTrue(result.isSuccess)
        assertEquals(links, result.getOrThrow())
        coVerify(exactly = 1) { appConfigRepository.getAppLinks() }
    }

    @Test
    fun `getAppLinks propagates failure`() = runTest {
        coEvery { appConfigRepository.getAppLinks() } returns Result.failure(RuntimeException("boom"))

        val result = GetAppLinksUseCase(appConfigRepository)()

        assertTrue(result.isFailure)
        assertEquals("boom", result.exceptionOrNull()?.message)
    }

    @Test
    fun `resetOnboarding delegates to userRepository with userId`() = runTest {
        coEvery { userRepository.resetOnboarding("user-1") } returns Result.success(Unit)

        val result = ResetOnboardingUseCase(userRepository)("user-1")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { userRepository.resetOnboarding("user-1") }
    }

    @Test
    fun `resetOnboarding propagates failure`() = runTest {
        coEvery { userRepository.resetOnboarding(any()) } returns Result.failure(RuntimeException("db"))

        val result = ResetOnboardingUseCase(userRepository)("user-1")

        assertTrue(result.isFailure)
        assertEquals("db", result.exceptionOrNull()?.message)
    }
}
