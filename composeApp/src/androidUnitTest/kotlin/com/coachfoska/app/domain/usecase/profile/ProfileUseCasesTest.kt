package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.auth.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProfileUseCasesTest {

    private val repo: UserRepository = mockk()

    @Test
    fun `GetUserProfileUseCase delegates to repository`() = runTest {
        coEvery { repo.getProfile("user-1") } returns Result.success(aUser())

        val result = GetUserProfileUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        coVerify { repo.getProfile("user-1") }
    }

    @Test
    fun `UpdateUserProfileUseCase delegates to repository with all parameters`() = runTest {
        coEvery { repo.updateProfile(any(), any(), any(), any(), any(), any(), any()) } returns Result.success(aUser())

        val result = UpdateUserProfileUseCase(repo)(
            userId = "user-1",
            fullName = "Alice",
            heightCm = 170f,
            weightKg = 65f,
            goal = UserGoal.WEIGHT_LOSS,
            activityLevel = ActivityLevel.LIGHTLY_ACTIVE
        )

        assertTrue(result.isSuccess)
        coVerify { repo.updateProfile("user-1", "Alice", null, 170f, 65f, UserGoal.WEIGHT_LOSS, ActivityLevel.LIGHTLY_ACTIVE) }
    }

    @Test
    fun `GetWeightHistoryUseCase delegates to repository`() = runTest {
        coEvery { repo.getWeightHistory("user-1") } returns Result.success(listOf(aWeightEntry()))

        val result = GetWeightHistoryUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }

    @Test
    fun `LogWeightUseCase delegates to repository`() = runTest {
        val entry = aWeightEntry()
        val date = LocalDate.parse("2026-04-03")
        coEvery { repo.logWeight("user-1", 74f, date, null) } returns Result.success(entry)

        val result = LogWeightUseCase(repo)("user-1", 74f, date, null)

        assertTrue(result.isSuccess)
        coVerify { repo.logWeight("user-1", 74f, date, null) }
    }
}

private fun aWeightEntry() = WeightEntry(
    id = "we-1", userId = "user-1", weightKg = 74f,
    recordedAt = LocalDate.parse("2026-04-03")
)
