package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.data.remote.dto.WeightEntryDto
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class UserRepositoryImplTest {

    private val dataSource: UserRemoteDataSource = mockk()
    private val repository = UserRepositoryImpl(dataSource)

    @Test
    fun `getProfile maps UserDto to domain User`() = runTest {
        val dto = UserDto(
            id = "user-1", email = "test@example.com", fullName = "Alice",
            goal = "muscle_gain", activityLevel = "moderately_active", onboardingComplete = true
        )
        coEvery { dataSource.getProfile("user-1") } returns dto

        val result = repository.getProfile("user-1")

        assertTrue(result.isSuccess)
        val user = result.getOrThrow()
        assertEquals("user-1", user.id)
        assertEquals("Alice", user.fullName)
        assertEquals(UserGoal.MUSCLE_GAIN, user.goal)
        assertEquals(ActivityLevel.MODERATELY_ACTIVE, user.activityLevel)
        assertTrue(user.onboardingComplete)
    }

    @Test
    fun `getProfile propagates data source exception`() = runTest {
        coEvery { dataSource.getProfile(any()) } throws RuntimeException("Not found")

        val result = repository.getProfile("user-1")

        assertTrue(result.isFailure)
        assertEquals("Not found", result.exceptionOrNull()?.message)
    }

    @Test
    fun `updateProfile merges fields and upserts`() = runTest {
        val existing = UserDto(id = "user-1", email = "test@example.com", fullName = "Alice")
        val updated = existing.copy(fullName = "Bob", weightKg = 80f)
        coEvery { dataSource.getProfile("user-1") } returns existing andThen updated
        coEvery { dataSource.upsertProfile(any()) } returns Unit

        val result = repository.updateProfile("user-1", fullName = "Bob", weightKg = 80f)

        assertTrue(result.isSuccess)
        coVerify { dataSource.upsertProfile(match { it.fullName == "Bob" && it.weightKg == 80f }) }
    }

    @Test
    fun `getWeightHistory maps DTOs to domain WeightEntries`() = runTest {
        val dto = WeightEntryDto(id = "we-1", userId = "user-1", weightKg = 75f, recordedAt = "2026-04-03")
        coEvery { dataSource.getWeightHistory("user-1") } returns listOf(dto)

        val result = repository.getWeightHistory("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals(75f, result.getOrThrow()[0].weightKg)
        assertEquals(LocalDate.parse("2026-04-03"), result.getOrThrow()[0].recordedAt)
    }

    @Test
    fun `logWeight inserts entry and maps to domain`() = runTest {
        val dto = WeightEntryDto(id = "we-1", userId = "user-1", weightKg = 74f, recordedAt = "2026-04-03")
        coEvery { dataSource.insertWeightEntry("user-1", 74f, LocalDate.parse("2026-04-03"), null) } returns dto

        val result = repository.logWeight("user-1", 74f, LocalDate.parse("2026-04-03"), null)

        assertTrue(result.isSuccess)
        assertEquals(74f, result.getOrThrow().weightKg)
    }
}
