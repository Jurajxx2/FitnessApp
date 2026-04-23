package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.AuthRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.UserDto
import io.github.jan.supabase.auth.user.UserInfo
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AuthRepositoryImplTest {

    private val authDataSource: AuthRemoteDataSource = mockk()
    private val userDataSource: UserRemoteDataSource = mockk()
    private val repository = AuthRepositoryImpl(authDataSource, userDataSource)

    // --- getCurrentUser ---

    @Test
    fun `getCurrentUser returns full User when profile exists`() = runTest {
        val userInfo = mockk<UserInfo> {
            every { id } returns "user-1"
            every { email } returns "test@example.com"
        }
        val dto = UserDto(id = "user-1", email = "test@example.com", fullName = "Alice", onboardingComplete = true)
        every { authDataSource.getCurrentUserInfo() } returns userInfo
        coEvery { userDataSource.getProfile("user-1") } returns dto

        val result = repository.getCurrentUser()

        assertNotNull(result)
        assertEquals("user-1", result.id)
        assertEquals("Alice", result.fullName)
        assertTrue(result.onboardingComplete)
        assertEquals("test@example.com", result.email)
    }

    @Test
    fun `getCurrentUser returns skeleton User when profile fetch fails`() = runTest {
        val userInfo = mockk<UserInfo> {
            every { id } returns "user-1"
            every { email } returns "test@example.com"
        }
        every { authDataSource.getCurrentUserInfo() } returns userInfo
        coEvery { userDataSource.getProfile("user-1") } throws RuntimeException("Not found")

        val result = repository.getCurrentUser()

        assertNotNull(result)
        assertEquals("user-1", result.id)
        assertEquals("test@example.com", result.email)
        assertNull(result.fullName)
        assertEquals(false, result.onboardingComplete)
    }

    @Test
    fun `getCurrentUser returns null when not authenticated`() = runTest {
        every { authDataSource.getCurrentUserInfo() } returns null

        val result = repository.getCurrentUser()

        assertNull(result)
    }

    // --- sendEmailOtp ---

    @Test
    fun `sendEmailOtp delegates to authDataSource`() = runTest {
        coEvery { authDataSource.sendEmailOtp("test@example.com") } returns Result.success(Unit)

        val result = repository.sendEmailOtp("test@example.com")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { authDataSource.sendEmailOtp("test@example.com") }
    }

    // --- signOut ---

    @Test
    fun `signOut calls authDataSource signOut`() = runTest {
        coEvery { authDataSource.signOut() } returns Unit

        val result = repository.signOut()

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { authDataSource.signOut() }
    }

    @Test
    fun `signOut wraps authDataSource exception as failure`() = runTest {
        coEvery { authDataSource.signOut() } throws RuntimeException("Network error")

        val result = repository.signOut()

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }

    // --- hasCompletedOnboarding ---

    @Test
    fun `hasCompletedOnboarding returns true when profile flag is set`() = runTest {
        val userInfo = mockk<UserInfo> { every { id } returns "user-1" }
        every { authDataSource.getCurrentUserInfo() } returns userInfo
        coEvery { userDataSource.getProfile("user-1") } returns UserDto(
            id = "user-1", email = "test@example.com", onboardingComplete = true
        )

        val result = repository.hasCompletedOnboarding()

        assertTrue(result)
    }

    @Test
    fun `hasCompletedOnboarding returns false when not authenticated`() = runTest {
        every { authDataSource.getCurrentUserInfo() } returns null

        val result = repository.hasCompletedOnboarding()

        assertEquals(false, result)
    }

    @Test
    fun `hasCompletedOnboarding returns false when profile fetch throws`() = runTest {
        val userInfo = mockk<UserInfo> { every { id } returns "user-1" }
        every { authDataSource.getCurrentUserInfo() } returns userInfo
        coEvery { userDataSource.getProfile("user-1") } throws RuntimeException("DB error")

        val result = repository.hasCompletedOnboarding()

        assertEquals(false, result)
    }
}
