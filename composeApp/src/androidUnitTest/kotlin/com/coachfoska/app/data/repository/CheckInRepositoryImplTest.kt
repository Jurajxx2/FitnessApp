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

class CheckInRepositoryImplTest {

    private val dataSource: CheckInRemoteDataSource = mockk()
    private val repository = CheckInRepositoryImpl(dataSource)

    private val week = LocalDate.parse("2026-07-06")

    @Test
    fun `submit builds upsert dto and maps result`() = runTest {
        val returned = CheckInDto(id = "ci-1", userId = "u-1", weekOf = "2026-07-06", energyLevel = 4)
        coEvery { dataSource.upsert(any()) } returns returned

        val result = repository.submit(
            CheckIn(id = "", userId = "u-1", weekOf = week, energyLevel = 4)
        )

        assertTrue(result.isSuccess)
        assertEquals("ci-1", result.getOrThrow().id)
        coVerify { dataSource.upsert(match<CheckInUpsertDto> { it.userId == "u-1" && it.weekOf == "2026-07-06" && it.energyLevel == 4 }) }
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
        assertEquals(null, result.getOrThrow())
    }

    @Test
    fun `submit propagates failure`() = runTest {
        coEvery { dataSource.upsert(any()) } throws RuntimeException("boom")
        val result = repository.submit(CheckIn(id = "", userId = "u-1", weekOf = week))
        assertTrue(result.isFailure)
        assertEquals("boom", result.exceptionOrNull()?.message)
    }
}
