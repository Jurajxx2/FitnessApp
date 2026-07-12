package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.SetLogDto
import com.coachfoska.app.data.remote.dto.SetLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutFeedbackDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.RecordDetail
import com.coachfoska.app.domain.model.RecordValue
import com.coachfoska.app.domain.model.SetLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
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
    fun `logWorkout inserts set_logs per exercise with correct exercise_log_id`() = runTest {
        val workoutLogDto = WorkoutLogDto(
            id = "wl-1", userId = "u", workoutName = "Push",
            durationMinutes = 60, loggedAt = "2026-05-21T10:00:00Z",
        )
        coEvery { dataSource.insertWorkoutLog("u", null, "Push", 60, null) } returns workoutLogDto
        coEvery { dataSource.insertExerciseLog(any()) } answers {
            val payload = firstArg<ExerciseLogInsertDto>()
            ExerciseLogDto(
                id = "el-${payload.exerciseName}", workoutLogId = workoutLogDto.id,
                exerciseName = payload.exerciseName, notes = payload.notes,
            )
        }
        val capturedSetPayloads = slot<List<SetLogInsertDto>>()
        coEvery { dataSource.insertSetLogs(capture(capturedSetPayloads)) } returns emptyList()

        val sets = listOf(
            SetLog(id = "", exerciseLogId = "", sortOrder = 1,
                targetReps = 10, actualReps = 10,
                targetWeightKg = 60f, actualWeightKg = 60f,
                rpe = 7, targetRestSeconds = 60, actualRestSeconds = null,
                completed = true),
        )
        val exerciseLogs = listOf(
            ExerciseLog(id = "", workoutLogId = "", exerciseName = "Bench Press",
                notes = null, sets = sets),
        )

        val result = repository.logWorkout("u", null, "Push", 60, null, exerciseLogs)

        assertTrue(result.isSuccess)
        assertEquals(1, capturedSetPayloads.captured.size)
        assertEquals("el-Bench Press", capturedSetPayloads.captured[0].exerciseLogId)
        assertEquals(1, capturedSetPayloads.captured[0].sortOrder)
    }

    @Test
    fun `logWorkout with empty sets skips insertSetLogs payload`() = runTest {
        val workoutLogDto = WorkoutLogDto(
            id = "wl-1", userId = "u", workoutName = "Push",
            durationMinutes = 60, loggedAt = "2026-05-21T10:00:00Z",
        )
        coEvery { dataSource.insertWorkoutLog("u", null, "Push", 60, null) } returns workoutLogDto
        coEvery { dataSource.insertExerciseLog(any()) } returns ExerciseLogDto(
            id = "el-1", workoutLogId = "wl-1", exerciseName = "Bench Press",
        )
        val capturedSetPayloads = slot<List<SetLogInsertDto>>()
        coEvery { dataSource.insertSetLogs(capture(capturedSetPayloads)) } returns emptyList()

        repository.logWorkout("u", null, "Push", 60, null,
            listOf(ExerciseLog(id = "", workoutLogId = "", exerciseName = "Bench Press", notes = null)))

        assertTrue(capturedSetPayloads.captured.isEmpty())
    }

    @Test
    fun `getWorkoutHistory stitches set_logs into exercise_logs by id`() = runTest {
        coEvery { dataSource.getWorkoutLogs("u") } returns listOf(
            WorkoutLogDto(id = "wl-1", userId = "u", workoutName = "A",
                durationMinutes = 45, loggedAt = "2026-05-21T10:00:00Z"),
        )
        coEvery { dataSource.getExerciseLogsForWorkouts(listOf("wl-1")) } returns listOf(
            ExerciseLogDto(id = "el-1", workoutLogId = "wl-1", exerciseName = "Bench Press"),
        )
        coEvery { dataSource.getSetLogsForExerciseLogs(listOf("el-1")) } returns listOf(
            SetLogDto(id = "s1", exerciseLogId = "el-1", sortOrder = 1,
                actualReps = 10, actualWeightKg = 60f, completed = true),
        )
        coEvery { dataSource.getWorkoutFeedback("u") } returns listOf(
            WorkoutFeedbackDto(
                id = "wf-1",
                userId = "u",
                coachId = "coach-1",
                workoutLogId = "wl-1",
                body = "Good pace.",
                createdAt = "2026-05-21T11:00:00Z",
                updatedAt = "2026-05-21T11:00:00Z",
            ),
            WorkoutFeedbackDto(
                id = "ef-1",
                userId = "u",
                coachId = "coach-1",
                exerciseLogId = "el-1",
                body = "Control the eccentric.",
                createdAt = "2026-05-21T11:05:00Z",
                updatedAt = "2026-05-21T11:05:00Z",
            ),
        )

        val result = repository.getWorkoutHistory("u")
        assertTrue(result.isSuccess)
        val logs = result.getOrThrow()
        assertEquals(1, logs.size)
        assertEquals(1, logs[0].exerciseLogs.size)
        assertEquals(1, logs[0].exerciseLogs[0].sets.size)
        assertEquals(10, logs[0].exerciseLogs[0].sets[0].actualReps)
        assertEquals("Good pace.", logs[0].feedback.single().body)
        assertEquals("Control the eccentric.", logs[0].exerciseLogs[0].feedback.single().body)
    }

    @Test
    fun `getExerciseHistory retains each parent workout timestamp for charts`() = runTest {
        val loggedAt = "2026-07-11T09:30:00Z"
        coEvery { dataSource.getExerciseLogHistory("u", "Bench Press") } returns listOf(
            ExerciseLogDto(
                id = "el-1",
                workoutLogId = "wl-1",
                exerciseName = "Bench Press",
            ) to loggedAt,
        )

        val result = repository.getExerciseHistory("u", "Bench Press")

        assertTrue(result.isSuccess)
        assertEquals(Instant.parse(loggedAt), result.getOrThrow().single().loggedAt)
    }

    @Test
    fun `getExerciseRecords exposes longest duration for timed exercises`() = runTest {
        coEvery { dataSource.getExerciseLogHistory("u", "Plank Hold") } returns listOf(
            ExerciseLogDto(
                id = "el-1",
                workoutLogId = "wl-1",
                exerciseName = "Plank Hold",
                setLogs = listOf(
                    SetLogDto(
                        id = "s-1",
                        exerciseLogId = "el-1",
                        sortOrder = 1,
                        actualDurationSeconds = 95,
                        completed = true,
                    ),
                ),
            ) to "2026-07-11T09:30:00Z",
        )

        val result = repository.getExerciseRecords("u", "Plank Hold")

        assertTrue(result.isSuccess)
        assertEquals(RecordValue.Duration(95), result.getOrThrow().longestDuration?.value)
        assertEquals(RecordDetail.LongestTimedSet, result.getOrThrow().longestDuration?.detail)
    }
}
