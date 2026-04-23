package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.auth.AppleSignInCredential
import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RemainingAuthUseCasesTest {

    private val authRepository: AuthRepository = mockk()
    private val socialAuthProvider: SocialAuthProvider = mockk()

    // --- GetCurrentUserUseCase ---

    @Test
    fun `getCurrentUser returns user when authenticated`() = runTest {
        val user = aUser()
        coEvery { authRepository.getCurrentUser() } returns user

        val result = GetCurrentUserUseCase(authRepository)()

        assertEquals(user, result)
    }

    @Test
    fun `getCurrentUser returns null when not authenticated`() = runTest {
        coEvery { authRepository.getCurrentUser() } returns null

        val result = GetCurrentUserUseCase(authRepository)()

        assertNull(result)
    }

    // --- SignOutUseCase ---

    @Test
    fun `signOut delegates to repository`() = runTest {
        coEvery { authRepository.signOut() } returns Result.success(Unit)

        val result = SignOutUseCase(authRepository)()

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { authRepository.signOut() }
    }

    @Test
    fun `signOut propagates repository failure`() = runTest {
        coEvery { authRepository.signOut() } returns Result.failure(RuntimeException("Sign-out failed"))

        val result = SignOutUseCase(authRepository)()

        assertTrue(result.isFailure)
        assertEquals("Sign-out failed", result.exceptionOrNull()?.message)
    }

    // --- SignInWithGoogleUseCase ---

    @Test
    fun `signInWithGoogle gets token from provider then calls repository`() = runTest {
        val user = aUser()
        coEvery { socialAuthProvider.getGoogleIdToken() } returns Result.success("google-id-token")
        coEvery { authRepository.signInWithGoogleIdToken("google-id-token") } returns Result.success(user)

        val result = SignInWithGoogleUseCase(authRepository, socialAuthProvider)()

        assertTrue(result.isSuccess)
        assertEquals(user, result.getOrThrow())
        coVerify(exactly = 1) { authRepository.signInWithGoogleIdToken("google-id-token") }
    }

    @Test
    fun `signInWithGoogle returns failure when provider fails without calling repository`() = runTest {
        coEvery { socialAuthProvider.getGoogleIdToken() } returns Result.failure(RuntimeException("No Google account"))

        val result = SignInWithGoogleUseCase(authRepository, socialAuthProvider)()

        assertTrue(result.isFailure)
        assertEquals("No Google account", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.signInWithGoogleIdToken(any()) }
    }

    // --- SignInWithAppleUseCase ---

    @Test
    fun `signInWithApple gets credential from provider then calls repository`() = runTest {
        val user = aUser()
        val cred = AppleSignInCredential(idToken = "apple-token", nonce = "nonce-123")
        coEvery { socialAuthProvider.getAppleCredential() } returns Result.success(cred)
        coEvery { authRepository.signInWithApple("apple-token", "nonce-123") } returns Result.success(user)

        val result = SignInWithAppleUseCase(authRepository, socialAuthProvider)()

        assertTrue(result.isSuccess)
        assertEquals(user, result.getOrThrow())
        coVerify(exactly = 1) { authRepository.signInWithApple("apple-token", "nonce-123") }
    }

    @Test
    fun `signInWithApple returns failure when provider fails without calling repository`() = runTest {
        coEvery { socialAuthProvider.getAppleCredential() } returns Result.failure(RuntimeException("Apple auth cancelled"))

        val result = SignInWithAppleUseCase(authRepository, socialAuthProvider)()

        assertTrue(result.isFailure)
        assertEquals("Apple auth cancelled", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.signInWithApple(any(), any()) }
    }
}
