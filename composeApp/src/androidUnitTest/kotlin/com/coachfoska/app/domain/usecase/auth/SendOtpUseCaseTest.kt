package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SendOtpUseCaseTest {

    private val authRepository = mockk<AuthRepository>()
    private val useCase = SendOtpUseCase(authRepository)

    @Test
    fun `valid email delegates to repo and returns success`() = runTest {
        coEvery { authRepository.sendEmailOtp(any()) } returns Result.success(Unit)

        val result = useCase("test@example.com")

        assertTrue(result.isSuccess)
        coVerify { authRepository.sendEmailOtp("test@example.com") }
    }

    @Test
    fun `blank email returns failure without calling repo`() = runTest {
        val result = useCase("   ")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.sendEmailOtp(any()) }
    }

    @Test
    fun `email without at-sign returns failure without calling repo`() = runTest {
        val result = useCase("notanemail")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.sendEmailOtp(any()) }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        val error = RuntimeException("network error")
        coEvery { authRepository.sendEmailOtp(any()) } returns Result.failure(error)

        val result = useCase("test@example.com")

        assertTrue(result.isFailure)
        assertFalse(result.isSuccess)
    }
}
