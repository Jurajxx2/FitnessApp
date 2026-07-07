package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.CheckInRepository
import com.coachfoska.app.domain.repository.UserRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertTrue

class CheckInUseCasesTest {

    private val checkInRepo: CheckInRepository = mockk()
    private val userRepo: UserRepository = mockk()
    private val week = LocalDate.parse("2026-07-06")

    @Test
    fun `submit also logs a weight entry when weight present`() = runTest {
        val ci = CheckIn(id = "", userId = "u-1", weekOf = week, weightKg = 73.2f)
        coEvery { checkInRepo.submit(ci) } returns Result.success(ci.copy(id = "ci-1"))
        coEvery { userRepo.logWeight("u-1", 73.2f, any(), any()) } returns
            Result.success(WeightEntry(id = "w-1", userId = "u-1", weightKg = 73.2f, recordedAt = week, notes = null))

        val result = SubmitCheckInUseCase(checkInRepo, userRepo).invoke(ci)

        assertTrue(result.isSuccess)
        coVerify { userRepo.logWeight("u-1", 73.2f, any(), any()) }
    }

    @Test
    fun `submit skips weight logging when weight absent`() = runTest {
        val ci = CheckIn(id = "", userId = "u-1", weekOf = week, weightKg = null)
        coEvery { checkInRepo.submit(ci) } returns Result.success(ci.copy(id = "ci-1"))

        val result = SubmitCheckInUseCase(checkInRepo, userRepo).invoke(ci)

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) { userRepo.logWeight(any(), any(), any(), any()) }
    }

    @Test
    fun `getHistory delegates to repo`() = runTest {
        coEvery { checkInRepo.getHistory("u-1") } returns Result.success(emptyList())
        assertTrue(GetCheckInHistoryUseCase(checkInRepo).invoke("u-1").isSuccess)
    }
}
