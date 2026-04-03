package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkoutRepositoryImplTest {

    private val dataSource: WorkoutRemoteDataSource = mockk()
    private val repository = WorkoutRepositoryImpl(dataSource)

    @Test
    fun `getAssignedWorkouts maps DTOs to domain models`() = runTest {
        val dto = WorkoutDto(id = "w1", name = "Monday Push", dayOfWeek = 0, durationMinutes = 60)
        coEvery { dataSource.getAssignedWorkouts("user-1") } returns listOf(dto)

        val result = repository.getAssignedWorkouts("user-1")

        assertTrue(result.isSuccess)
        val workouts = result.getOrThrow()
        assertEquals(1, workouts.size)
        assertEquals("w1", workouts[0].id)
        assertEquals("Monday Push", workouts[0].name)
        assertEquals(DayOfWeek.MONDAY, workouts[0].dayOfWeek)
        assertEquals(60, workouts[0].durationMinutes)
    }

    @Test
    fun `getAssignedWorkouts propagates data source exception`() = runTest {
        coEvery { dataSource.getAssignedWorkouts(any()) } throws RuntimeException("DB error")

        val result = repository.getAssignedWorkouts("user-1")

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `logWorkout with exercise logs calls insertExerciseLogs`() = runTest {
        val logDto = aWorkoutLogDto()
        coEvery { dataSource.insertWorkoutLog(any(), any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertExerciseLogs(any<List<ExerciseLogInsertDto>>()) } returns listOf(anExerciseLogDto())

        val exerciseLogs = listOf(anExerciseLog())
        val result = repository.logWorkout("user-1", "w1", "Push Day", 60, null, exerciseLogs)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertExerciseLogs(any<List<ExerciseLogInsertDto>>()) }
    }

    @Test
    fun `logWorkout with empty exercise logs skips insertExerciseLogs`() = runTest {
        val logDto = aWorkoutLogDto()
        coEvery { dataSource.insertWorkoutLog(any(), any(), any(), any(), any()) } returns logDto

        repository.logWorkout("user-1", null, "Push Day", 60, null, emptyList())

        coVerify(exactly = 0) { dataSource.insertExerciseLogs(any<List<ExerciseLogInsertDto>>()) }
    }

    @Test
    fun `getWorkoutHistory maps DTOs to domain models`() = runTest {
        coEvery { dataSource.getWorkoutHistory("user-1") } returns listOf(aWorkoutLogDto())

        val result = repository.getWorkoutHistory("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals("log-1", result.getOrThrow()[0].id)
    }
}

private fun aWorkoutLogDto() = WorkoutLogDto(
    id = "log-1",
    userId = "user-1",
    workoutName = "Push Day",
    durationMinutes = 60,
    loggedAt = "2026-04-03T10:00:00Z"
)

private fun anExerciseLogDto() = ExerciseLogDto(
    id = "elog-1",
    workoutLogId = "log-1",
    exerciseName = "Bench Press",
    setsCompleted = 3
)

private fun anExerciseLog() = ExerciseLog(
    id = "elog-1",
    workoutLogId = "log-1",
    exerciseName = "Bench Press",
    setsCompleted = 3,
    repsCompleted = "10",
    weightKg = 80f,
    notes = null
)
