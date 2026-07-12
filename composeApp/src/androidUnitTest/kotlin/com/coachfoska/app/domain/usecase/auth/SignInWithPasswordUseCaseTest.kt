package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SignInWithPasswordUseCaseTest {
    private val authRepository = mockk<AuthRepository>()
    private val useCase = SignInWithPasswordUseCase(authRepository)

    @Test
    fun `valid credentials normalize email and delegate`() = runTest {
        val user = aUser()
        coEvery { authRepository.signInWithEmailPassword("test@example.com", " secret ") } returns
            Result.success(user)

        val result = useCase("  TEST@example.com ", " secret ")

        assertEquals(user, result.getOrThrow())
        coVerify(exactly = 1) { authRepository.signInWithEmailPassword("test@example.com", " secret ") }
    }

    @Test
    fun `blank password fails without calling repository`() = runTest {
        val result = useCase("test@example.com", "   ")

        assertTrue(result.isFailure)
        assertEquals("Password is required", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.signInWithEmailPassword(any(), any()) }
    }

    @Test
    fun `invalid email fails without calling repository`() = runTest {
        val result = useCase("invalid", "secret")

        assertTrue(result.isFailure)
        assertEquals("Invalid email address", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.signInWithEmailPassword(any(), any()) }
    }
}
