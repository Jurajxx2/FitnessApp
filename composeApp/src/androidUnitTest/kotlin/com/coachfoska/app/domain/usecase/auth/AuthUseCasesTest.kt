package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthUseCasesTest {

    private val authRepository: AuthRepository = mockk()

    // --- SendOtpUseCase ---

    @Test
    fun `sendOtp with valid email calls repository`() = runTest {
        coEvery { authRepository.sendEmailOtp("test@example.com") } returns Result.success(Unit)
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("test@example.com")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { authRepository.sendEmailOtp("test@example.com") }
    }

    @Test
    fun `sendOtp trims whitespace before calling repository`() = runTest {
        coEvery { authRepository.sendEmailOtp("test@example.com") } returns Result.success(Unit)
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("  test@example.com  ")

        assertTrue(result.isSuccess)
        coVerify { authRepository.sendEmailOtp("test@example.com") }
    }

    @Test
    fun `sendOtp with blank email returns failure without calling repository`() = runTest {
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("")

        assertTrue(result.isFailure)
        assertEquals("Invalid email address", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.sendEmailOtp(any()) }
    }

    @Test
    fun `sendOtp with email missing at-sign returns failure without calling repository`() = runTest {
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("notanemail")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.sendEmailOtp(any()) }
    }

    @Test
    fun `sendOtp propagates repository failure`() = runTest {
        coEvery { authRepository.sendEmailOtp(any()) } returns Result.failure(RuntimeException("Server error"))
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("test@example.com")

        assertTrue(result.isFailure)
        assertEquals("Server error", result.exceptionOrNull()?.message)
    }

    // --- VerifyOtpUseCase ---

    @Test
    fun `verifyOtp with valid 6-digit OTP calls repository`() = runTest {
        val user = aUser()
        coEvery { authRepository.verifyEmailOtp("test@example.com", "123456") } returns Result.success(user)
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "123456")

        assertTrue(result.isSuccess)
        assertEquals(user, result.getOrThrow())
    }

    @Test
    fun `verifyOtp with OTP shorter than 6 digits returns failure`() = runTest {
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "12345")

        assertTrue(result.isFailure)
        assertEquals("OTP must be 6 digits", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.verifyEmailOtp(any(), any()) }
    }

    @Test
    fun `verifyOtp with non-digit OTP returns failure`() = runTest {
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "12345X")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.verifyEmailOtp(any(), any()) }
    }

    @Test
    fun `verifyOtp propagates repository failure`() = runTest {
        coEvery { authRepository.verifyEmailOtp(any(), any()) } returns Result.failure(RuntimeException("Invalid OTP"))
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "999999")

        assertTrue(result.isFailure)
        assertEquals("Invalid OTP", result.exceptionOrNull()?.message)
    }
}

// --- Shared fixtures (used by other test files) ---

fun aUser(
    id: String = "user-1",
    email: String = "test@example.com",
    onboardingComplete: Boolean = true
) = com.coachfoska.app.domain.model.User(
    id = id,
    email = email,
    fullName = "Test User",
    age = 30,
    heightCm = 175f,
    weightKg = 75f,
    goal = com.coachfoska.app.domain.model.UserGoal.MUSCLE_GAIN,
    activityLevel = com.coachfoska.app.domain.model.ActivityLevel.MODERATELY_ACTIVE,
    onboardingComplete = onboardingComplete
)
