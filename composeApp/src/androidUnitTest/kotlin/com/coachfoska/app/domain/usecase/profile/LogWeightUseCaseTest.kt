package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.fixtures.aWeightEntry
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LogWeightUseCaseTest {

    private val userRepository = mockk<UserRepository>()
    private val useCase = LogWeightUseCase(userRepository)

    @Test
    fun `delegates to repo and returns weight entry on success`() = runTest {
        val entry = aWeightEntry(weightKg = 74.5f)
        val date = LocalDate.parse("2026-04-06")
        coEvery { userRepository.logWeight(any(), any(), any(), any()) } returns Result.success(entry)

        val result = useCase("user-1", 74.5f, date)

        assertTrue(result.isSuccess)
        assertEquals(entry, result.getOrNull())
        coVerify { userRepository.logWeight("user-1", 74.5f, date, null) }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { userRepository.logWeight(any(), any(), any(), any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase("user-1", 74.5f, LocalDate.parse("2026-04-06"))

        assertTrue(result.isFailure)
    }
}
