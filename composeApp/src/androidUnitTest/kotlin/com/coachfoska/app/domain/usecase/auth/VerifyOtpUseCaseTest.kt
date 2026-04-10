package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.fixtures.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

class VerifyOtpUseCaseTest {

    private val authRepository = mockk<AuthRepository>()
    private val useCase = VerifyOtpUseCase(authRepository)

    @Test
    fun `valid 6-digit otp delegates to repo and returns user`() = runTest {
        val user = aUser()
        coEvery { authRepository.verifyEmailOtp(any(), any()) } returns Result.success(user)

        val result = useCase("test@example.com", "123456")

        assertTrue(result.isSuccess)
        coVerify { authRepository.verifyEmailOtp("test@example.com", "123456") }
    }

    @Test
    fun `otp shorter than 6 digits returns failure without calling repo`() = runTest {
        val result = useCase("test@example.com", "12345")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.verifyEmailOtp(any(), any()) }
    }

    @Test
    fun `otp with non-digit characters returns failure without calling repo`() = runTest {
        val result = useCase("test@example.com", "12345a")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.verifyEmailOtp(any(), any()) }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { authRepository.verifyEmailOtp(any(), any()) } returns Result.failure(RuntimeException("wrong otp"))

        val result = useCase("test@example.com", "999999")

        assertTrue(result.isFailure)
    }
}
