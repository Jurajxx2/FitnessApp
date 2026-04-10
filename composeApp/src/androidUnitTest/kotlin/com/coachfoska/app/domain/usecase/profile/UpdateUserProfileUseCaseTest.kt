package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.fixtures.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class UpdateUserProfileUseCaseTest {

    private val userRepository = mockk<UserRepository>()
    private val useCase = UpdateUserProfileUseCase(userRepository)

    @Test
    fun `delegates all fields to repo and returns updated user`() = runTest {
        val updated = aUser()
        coEvery { userRepository.updateProfile(any(), any(), any(), any(), any(), any(), any()) } returns Result.success(updated)

        val result = useCase(userId = "user-1", fullName = "New Name", goal = UserGoal.WEIGHT_LOSS)

        assertTrue(result.isSuccess)
        assertEquals(updated, result.getOrNull())
        coVerify { userRepository.updateProfile("user-1", "New Name", null, null, null, UserGoal.WEIGHT_LOSS, null) }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { userRepository.updateProfile(any(), any(), any(), any(), any(), any(), any()) } returns Result.failure(RuntimeException("update failed"))

        val result = useCase(userId = "user-1")

        assertTrue(result.isFailure)
    }
}
