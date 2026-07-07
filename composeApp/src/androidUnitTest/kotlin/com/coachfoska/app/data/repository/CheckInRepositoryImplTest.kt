package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.CheckInRemoteDataSource
import com.coachfoska.app.data.remote.dto.CheckInDto
import com.coachfoska.app.data.remote.dto.CheckInUpsertDto
import com.coachfoska.app.domain.model.CheckIn
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertNull

class CheckInRepositoryImplTest {

    private val dataSource: CheckInRemoteDataSource = mockk()
    private val repository = CheckInRepositoryImpl(dataSource)

    private val week = LocalDate.parse("2026-07-06")

    @Test
    fun `submit builds upsert dto and maps result`() = runTest {
        val returned = CheckInDto(
            id = "ci-1", userId = "u-1", weekOf = "2026-07-06",
            weightKg = 74.5f, energyLevel = 4, sleepQuality = 3, stressLevel = 2,
            trainingAdherence = 3, nutritionAdherence = 5, notes = "solid week",
            photoFrontPath = "u-1/front.jpg", photoSidePath = "u-1/side.jpg"
        )
        coEvery { dataSource.upsert(any()) } returns returned

        val result = repository.submit(
            CheckIn(
                id = "", userId = "u-1", weekOf = week,
                weightKg = 74.5f, energyLevel = 4, sleepQuality = 3, stressLevel = 2,
                trainingAdherence = 3, nutritionAdherence = 5, notes = "solid week",
                photoFrontPath = "u-1/front.jpg", photoSidePath = "u-1/side.jpg",
            )
        )

        assertTrue(result.isSuccess)
        assertEquals("ci-1", result.getOrThrow().id)
        coVerify {
            dataSource.upsert(match<CheckInUpsertDto> {
                it.userId == "u-1" && it.weekOf == "2026-07-06" &&
                    it.weightKg == 74.5f && it.energyLevel == 4 && it.sleepQuality == 3 &&
                    it.stressLevel == 2 && it.trainingAdherence == 3 && it.nutritionAdherence == 5 &&
                    it.notes == "solid week" &&
                    it.photoFrontPath == "u-1/front.jpg" && it.photoSidePath == "u-1/side.jpg"
            })
        }
    }

    @Test
    fun `getHistory maps list`() = runTest {
        coEvery { dataSource.getHistory("u-1") } returns listOf(
            CheckInDto(id = "ci-1", userId = "u-1", weekOf = "2026-07-06"),
        )
        val result = repository.getHistory("u-1")
        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }

    @Test
    fun `getForWeek returns null when absent`() = runTest {
        coEvery { dataSource.getForWeek("u-1", "2026-07-06") } returns null
        val result = repository.getForWeek("u-1", week)
        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun `submit propagates failure`() = runTest {
        coEvery { dataSource.upsert(any()) } throws RuntimeException("boom")
        val result = repository.submit(CheckIn(id = "", userId = "u-1", weekOf = week))
        assertTrue(result.isFailure)
        assertEquals("boom", result.exceptionOrNull()?.message)
    }
}
