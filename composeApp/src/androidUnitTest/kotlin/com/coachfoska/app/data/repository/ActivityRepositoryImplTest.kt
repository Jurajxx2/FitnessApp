package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ActivityRemoteDataSource
import com.coachfoska.app.data.remote.dto.GeneralActivityLogDto
import com.coachfoska.app.data.remote.dto.GeneralActivityLogInsertDto
import com.coachfoska.app.domain.model.ActivityType
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ActivityRepositoryImplTest {

    private val dataSource: ActivityRemoteDataSource = mockk()
    private val repository = ActivityRepositoryImpl(dataSource)

    @Test
    fun `logActivity returns mapped domain on success`() = runTest {
        val captured = slot<GeneralActivityLogInsertDto>()
        coEvery { dataSource.insertActivity(capture(captured)) } returns GeneralActivityLogDto(
            id = "new-id", userId = "u", activityType = "RUNNING",
            durationMinutes = 30, distanceKm = 5.0, rpe = 7,
            loggedAt = "2026-05-21T10:00:00Z", notes = null,
        )

        val result = repository.logActivity(
            userId = "u", type = ActivityType.RUNNING, durationMinutes = 30,
            distanceKm = 5.0, rpe = 7, loggedAt = Instant.parse("2026-05-21T10:00:00Z"),
            notes = null,
        )

        assertTrue(result.isSuccess)
        assertEquals("new-id", result.getOrThrow().id)
        assertEquals(ActivityType.RUNNING, result.getOrThrow().type)
        assertEquals("RUNNING", captured.captured.activityType)
        assertEquals(5.0, captured.captured.distanceKm)
    }

    @Test
    fun `logActivity propagates failure`() = runTest {
        coEvery { dataSource.insertActivity(any()) } throws RuntimeException("boom")
        val result = repository.logActivity(
            userId = "u", type = ActivityType.YOGA, durationMinutes = 60,
            distanceKm = null, rpe = null,
            loggedAt = Instant.parse("2026-05-21T10:00:00Z"), notes = null,
        )
        assertTrue(result.isFailure)
        assertEquals("boom", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getActivityHistory maps list and propagates order`() = runTest {
        coEvery { dataSource.getHistory("u") } returns listOf(
            GeneralActivityLogDto(
                id = "1", userId = "u", activityType = "CYCLING",
                durationMinutes = 60, distanceKm = 20.0, rpe = 6,
                loggedAt = "2026-05-21T10:00:00Z", notes = null,
            ),
            GeneralActivityLogDto(
                id = "2", userId = "u", activityType = "WALKING",
                durationMinutes = 30, distanceKm = 2.5, rpe = 4,
                loggedAt = "2026-05-20T10:00:00Z", notes = null,
            ),
        )

        val result = repository.getActivityHistory("u")
        assertTrue(result.isSuccess)
        val logs = result.getOrThrow()
        assertEquals(2, logs.size)
        assertEquals("1", logs[0].id)
        coVerify(exactly = 1) { dataSource.getHistory("u") }
    }
}
