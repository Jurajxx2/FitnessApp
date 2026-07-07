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
    fun `first submit with weight logs a weight entry`() = runTest {
        val ci = CheckIn(id = "", userId = "u-1", weekOf = week, weightKg = 73.2f)
        coEvery { checkInRepo.getForWeek("u-1", week) } returns Result.success(null)
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
        coEvery { checkInRepo.getForWeek("u-1", week) } returns Result.success(null)
        coEvery { checkInRepo.submit(ci) } returns Result.success(ci.copy(id = "ci-1"))

        val result = SubmitCheckInUseCase(checkInRepo, userRepo).invoke(ci)

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) { userRepo.logWeight(any(), any(), any(), any()) }
    }

    @Test
    fun `re-submit with unchanged weight does not duplicate the weight entry`() = runTest {
        val existing = CheckIn(id = "ci-1", userId = "u-1", weekOf = week, weightKg = 73.2f, notes = "old notes")
        val ci = existing.copy(notes = "edited notes")
        coEvery { checkInRepo.getForWeek("u-1", week) } returns Result.success(existing)
        coEvery { checkInRepo.submit(ci) } returns Result.success(ci)

        val result = SubmitCheckInUseCase(checkInRepo, userRepo).invoke(ci)

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) { userRepo.logWeight(any(), any(), any(), any()) }
    }

    @Test
    fun `re-submit with a changed weight logs the new weight entry`() = runTest {
        val existing = CheckIn(id = "ci-1", userId = "u-1", weekOf = week, weightKg = 73.2f)
        val ci = existing.copy(weightKg = 74.0f)
        coEvery { checkInRepo.getForWeek("u-1", week) } returns Result.success(existing)
        coEvery { checkInRepo.submit(ci) } returns Result.success(ci)
        coEvery { userRepo.logWeight("u-1", 74.0f, any(), any()) } returns
            Result.success(WeightEntry(id = "w-2", userId = "u-1", weightKg = 74.0f, recordedAt = week, notes = null))

        val result = SubmitCheckInUseCase(checkInRepo, userRepo).invoke(ci)

        assertTrue(result.isSuccess)
        coVerify { userRepo.logWeight("u-1", 74.0f, any(), any()) }
    }

    @Test
    fun `submit succeeds even if logWeight throws`() = runTest {
        val ci = CheckIn(id = "", userId = "u-1", weekOf = week, weightKg = 73.2f)
        coEvery { checkInRepo.getForWeek("u-1", week) } returns Result.success(null)
        coEvery { checkInRepo.submit(ci) } returns Result.success(ci.copy(id = "ci-1"))
        coEvery { userRepo.logWeight("u-1", 73.2f, any(), any()) } throws RuntimeException("boom")

        val result = SubmitCheckInUseCase(checkInRepo, userRepo).invoke(ci)

        assertTrue(result.isSuccess)
    }

    @Test
    fun `getHistory delegates to repo`() = runTest {
        coEvery { checkInRepo.getHistory("u-1") } returns Result.success(emptyList())
        assertTrue(GetCheckInHistoryUseCase(checkInRepo).invoke("u-1").isSuccess)
    }
}
