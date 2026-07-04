package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.OnboardingRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.OnboardingData
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OnboardingRepositoryImplTest {

    private val onboardingDataSource: OnboardingRemoteDataSource = mockk()
    private val userDataSource: UserRemoteDataSource = mockk()
    private val repository = OnboardingRepositoryImpl(onboardingDataSource, userDataSource)

    private val data = OnboardingData(
        goal = FitnessGoal.BUILD_MUSCLE,
        age = 28,
        heightCm = 180,
        weightKg = 82f,
        name = "Alice",
    )

    @Test
    fun `saveResponses persists quiz answers and mirrors profile fields`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } just Runs
        coEvery { userDataSource.getProfile("user-1") } returns UserDto(id = "user-1", email = "a@b.com", fullName = "Old")
        val profileSlot = slot<UserDto>()
        coEvery { userDataSource.upsertProfile(capture(profileSlot)) } just Runs

        val result = repository.saveResponses("user-1", data)

        assertTrue(result.isSuccess)
        val saved = profileSlot.captured
        assertEquals("Alice", saved.fullName)
        assertEquals(28, saved.age)
        assertEquals(180f, saved.heightCm)
        assertEquals(82f, saved.weightKg)
        assertEquals("build_muscle", saved.goal)
        assertTrue(saved.onboardingComplete)
    }

    @Test
    fun `saveResponses falls back to skeleton profile when getProfile fails`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } just Runs
        coEvery { userDataSource.getProfile("user-1") } throws RuntimeException("no profile yet")
        val profileSlot = slot<UserDto>()
        coEvery { userDataSource.upsertProfile(capture(profileSlot)) } just Runs

        val result = repository.saveResponses("user-1", data)

        assertTrue(result.isSuccess)
        assertEquals("user-1", profileSlot.captured.id)
        assertEquals("Alice", profileSlot.captured.fullName)
        assertTrue(profileSlot.captured.onboardingComplete)
    }

    @Test
    fun `saveResponses keeps existing name when onboarding name is blank`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } just Runs
        coEvery { userDataSource.getProfile("user-1") } returns UserDto(id = "user-1", email = "a@b.com", fullName = "Existing")
        val profileSlot = slot<UserDto>()
        coEvery { userDataSource.upsertProfile(capture(profileSlot)) } just Runs

        val result = repository.saveResponses("user-1", data.copy(name = ""))

        assertTrue(result.isSuccess)
        assertEquals("Existing", profileSlot.captured.fullName)
    }

    @Test
    fun `saveResponses returns failure when upsertResponse throws`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } throws RuntimeException("db down")

        val result = repository.saveResponses("user-1", data)

        assertTrue(result.isFailure)
        assertEquals("db down", result.exceptionOrNull()?.message)
    }
}
