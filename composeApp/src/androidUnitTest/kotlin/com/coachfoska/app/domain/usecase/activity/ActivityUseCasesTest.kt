package com.coachfoska.app.domain.usecase.activity

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.repository.ActivityRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ActivityUseCasesTest {

    private val repo: ActivityRepository = mockk()

    @Test
    fun `LogGeneralActivityUseCase delegates to repository`() = runTest {
        val expected = GeneralActivityLog(
            id = "1", userId = "u", type = ActivityType.RUNNING,
            durationMinutes = 30, distanceKm = 5.0, rpe = 7,
            loggedAt = Instant.parse("2026-05-21T10:00:00Z"), notes = null,
        )
        coEvery {
            repo.logActivity("u", ActivityType.RUNNING, 30, 5.0, 7, any(), null)
        } returns Result.success(expected)

        val useCase = LogGeneralActivityUseCase(repo)
        val result = useCase("u", ActivityType.RUNNING, 30, 5.0, 7,
            Instant.parse("2026-05-21T10:00:00Z"), null)

        assertTrue(result.isSuccess)
        assertEquals(expected, result.getOrThrow())
    }

    @Test
    fun `GetActivityHistoryUseCase returns repo result`() = runTest {
        coEvery { repo.getActivityHistory("u") } returns Result.success(emptyList())
        val useCase = GetActivityHistoryUseCase(repo)
        val result = useCase("u")
        assertTrue(result.isSuccess)
        assertEquals(emptyList(), result.getOrThrow())
    }
}
