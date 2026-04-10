package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.fixtures.aWeightEntry
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetWeightHistoryUseCaseTest {

    private val userRepository = mockk<UserRepository>()
    private val useCase = GetWeightHistoryUseCase(userRepository)

    @Test
    fun `delegates to repo and returns weight entries`() = runTest {
        val entries = listOf(aWeightEntry("w1", weightKg = 75f), aWeightEntry("w2", weightKg = 74f))
        coEvery { userRepository.getWeightHistory(any()) } returns Result.success(entries)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(entries, result.getOrNull())
        coVerify { userRepository.getWeightHistory("user-1") }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { userRepository.getWeightHistory(any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}
