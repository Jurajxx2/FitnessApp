package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.fixtures.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetUserProfileUseCaseTest {

    private val userRepository = mockk<UserRepository>()
    private val useCase = GetUserProfileUseCase(userRepository)

    @Test
    fun `delegates to repo and returns user`() = runTest {
        val user = aUser()
        coEvery { userRepository.getProfile(any()) } returns Result.success(user)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(user, result.getOrNull())
        coVerify { userRepository.getProfile("user-1") }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { userRepository.getProfile(any()) } returns Result.failure(RuntimeException("not found"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}
