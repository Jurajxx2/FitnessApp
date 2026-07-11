package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.SetLog
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkoutDtoTest {

    @Test fun `WorkoutLogDto gives nested exercise logs the parent session timestamp`() {
        val loggedAt = "2026-07-11T09:30:00Z"
        val domain = WorkoutLogDto(
            id = "wl-1",
            userId = "user-1",
            workoutName = "Push",
            loggedAt = loggedAt,
            exerciseLogs = listOf(
                ExerciseLogDto(id = "el-1", workoutLogId = "wl-1", exerciseName = "Bench Press"),
            ),
        ).toDomain()

        assertEquals(Instant.parse(loggedAt), domain.exerciseLogs.single().loggedAt)
    }

    @Test fun `ExerciseLogDto with set_logs maps to domain sets`() {
        val dto = ExerciseLogDto(
            id = "el-1", workoutLogId = "wl-1", exerciseName = "Squat",
            setsCompleted = 0, repsCompleted = null, weightKg = null, notes = null,
            setLogs = listOf(
                SetLogDto(id = "s1", exerciseLogId = "el-1", sortOrder = 1,
                    targetReps = 10, actualReps = 10, targetWeightKg = 100f,
                    actualWeightKg = 100f, rpe = 7, targetRestSeconds = 90,
                    actualRestSeconds = null, completed = true),
                SetLogDto(id = "s2", exerciseLogId = "el-1", sortOrder = 2,
                    targetReps = 10, actualReps = 8, targetWeightKg = 100f,
                    actualWeightKg = 100f, rpe = 9, targetRestSeconds = 90,
                    actualRestSeconds = null, completed = true),
            ),
        )

        val domain = dto.toDomain()
        assertEquals(2, domain.sets.size)
        assertEquals(SetLog(
            id = "s1", exerciseLogId = "el-1", sortOrder = 1,
            targetReps = 10, actualReps = 10,
            targetWeightKg = 100f, actualWeightKg = 100f,
            rpe = 7, targetRestSeconds = 90, actualRestSeconds = null,
            completed = true,
        ), domain.sets[0])
        assertEquals(8, domain.sets[1].actualReps)
    }

    @Test fun `ExerciseLogDto with empty set_logs synthesizes from flat columns`() {
        val dto = ExerciseLogDto(
            id = "el-1", workoutLogId = "wl-1", exerciseName = "Squat",
            setsCompleted = 3, repsCompleted = "10", weightKg = 100f, notes = null,
            setLogs = emptyList(),
        )
        val domain = dto.toDomain()
        assertEquals(3, domain.sets.size)
        assertTrue(domain.sets.all { it.completed })
        assertTrue(domain.sets.all { it.actualReps == 10 })
        assertTrue(domain.sets.all { it.actualWeightKg == 100f })
        assertEquals(listOf(1, 2, 3), domain.sets.map { it.sortOrder })
    }

    @Test fun `ExerciseLogDto legacy reps range like 8-12 parses to lower bound`() {
        val dto = ExerciseLogDto(
            id = "el-1", workoutLogId = "wl-1", exerciseName = "Squat",
            setsCompleted = 2, repsCompleted = "8-12", weightKg = 80f, notes = null,
            setLogs = emptyList(),
        )
        val domain = dto.toDomain()
        assertEquals(2, domain.sets.size)
        assertTrue(domain.sets.all { it.actualReps == 8 })
    }

    @Test fun `ExerciseLogDto legacy non-numeric reps yields null actualReps`() {
        val dto = ExerciseLogDto(
            id = "el-1", workoutLogId = "wl-1", exerciseName = "Plank",
            setsCompleted = 1, repsCompleted = "30s", weightKg = null, notes = null,
            setLogs = emptyList(),
        )
        val domain = dto.toDomain()
        assertEquals(1, domain.sets.size)
        assertEquals(null, domain.sets[0].actualReps)
    }

    @Test fun `ExerciseLogDto with both empty sets and zero setsCompleted yields no sets`() {
        val dto = ExerciseLogDto(
            id = "el-1", workoutLogId = "wl-1", exerciseName = "Squat",
            setsCompleted = 0, repsCompleted = null, weightKg = null, notes = null,
            setLogs = emptyList(),
        )
        assertEquals(0, dto.toDomain().sets.size)
    }
}
