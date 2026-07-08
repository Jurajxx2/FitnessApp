package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.fixtures.aSetLog
import com.coachfoska.app.fixtures.aWorkout
import com.coachfoska.app.fixtures.aWorkoutLog
import com.coachfoska.app.fixtures.anExerciseLog
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private fun exercise(muscle: String?) = WorkoutExercise(
    id = "e", workoutId = "w", name = "Ex", muscleGroup = muscle,
    sets = 3, reps = "10", restSeconds = 90, tips = null,
)

class ActivityHubLogicTest {

    // 2026-04-09 is a Thursday (DayOfWeek index 3). Week runs Mon 04-06 .. Sun 04-12.
    private val today = LocalDate(2026, 4, 9)
    private val zone = TimeZone.UTC

    @Test
    fun `buildWeeklyActivity classifies every day`() {
        val workouts = listOf(
            aWorkout(id = "w-mon").copy(dayOfWeek = DayOfWeek.MONDAY),
            aWorkout(id = "w-fri").copy(dayOfWeek = DayOfWeek.FRIDAY),
        )
        // Completed log on Wed 2026-04-08 (this week).
        val history = listOf(
            aWorkoutLog(id = "l1").copy(loggedAt = Instant.parse("2026-04-08T10:00:00Z")),
        )

        val result = buildWeeklyActivity(workouts, history, today, zone)

        assertEquals(7, result.size)
        assertEquals(DayActivityStatus.MISSED, result[0].status)     // Mon: assigned, past
        assertEquals(DayActivityStatus.REST, result[1].status)       // Tue: nothing
        assertEquals(DayActivityStatus.COMPLETED, result[2].status)  // Wed: logged
        assertEquals(DayActivityStatus.TODAY, result[3].status)      // Thu: today
        assertEquals(DayActivityStatus.SCHEDULED, result[4].status)  // Fri: assigned, future
        assertEquals(DayActivityStatus.REST, result[5].status)       // Sat
        assertEquals(DayActivityStatus.REST, result[6].status)       // Sun
    }

    @Test
    fun `buildWeeklyActivity ignores logs from other weeks`() {
        val history = listOf(
            aWorkoutLog(id = "old").copy(loggedAt = Instant.parse("2026-03-30T10:00:00Z")), // Mon, prior week
        )
        val result = buildWeeklyActivity(emptyList(), history, today, zone)
        assertEquals(DayActivityStatus.REST, result[0].status) // Mon not completed this week
    }

    @Test
    fun `deriveTodayVolumeKg returns null when no workout`() {
        assertNull(deriveTodayVolumeKg(null, emptyList()))
    }

    @Test
    fun `deriveWeeklyCompliance counts assigned completions only`() {
        val workouts = listOf(
            aWorkout(id = "w-mon").copy(dayOfWeek = DayOfWeek.MONDAY),
            aWorkout(id = "w-fri").copy(dayOfWeek = DayOfWeek.FRIDAY),
        )
        val history = listOf(
            aWorkoutLog(id = "planned-done").copy(
                workoutId = "w-mon",
                loggedAt = Instant.parse("2026-04-06T10:00:00Z"),
            ),
            aWorkoutLog(id = "extra-done").copy(
                workoutId = null,
                workoutName = "Extra walk",
                loggedAt = Instant.parse("2026-04-08T10:00:00Z"),
            ),
        )

        val days = buildWeeklyActivity(workouts, history, today, zone)
        val compliance = deriveWeeklyCompliance(days)

        assertEquals(1, compliance.completed)
        assertEquals(2, compliance.assigned)
    }

    @Test
    fun `buildWeeklyActivity prefers matching assigned workout log over later extra log`() {
        val workouts = listOf(aWorkout(id = "w-mon").copy(dayOfWeek = DayOfWeek.MONDAY))
        val history = listOf(
            aWorkoutLog(id = "planned-done").copy(
                workoutId = "w-mon",
                workoutName = "Assigned Push",
                loggedAt = Instant.parse("2026-04-06T10:00:00Z"),
            ),
            aWorkoutLog(id = "extra-done").copy(
                workoutId = null,
                workoutName = "Extra walk",
                loggedAt = Instant.parse("2026-04-06T18:00:00Z"),
            ),
        )

        val days = buildWeeklyActivity(workouts, history, today, zone)

        assertEquals("planned-done", days[0].completedLog?.id)
        assertEquals(1, deriveWeeklyCompliance(days).completed)
    }

    @Test
    fun `buildWeeklyActivity does not complete assigned day with unmatched extra log`() {
        val workouts = listOf(aWorkout(id = "w-mon").copy(dayOfWeek = DayOfWeek.MONDAY))
        val history = listOf(
            aWorkoutLog(id = "extra-done").copy(
                workoutId = null,
                workoutName = "Extra walk",
                loggedAt = Instant.parse("2026-04-06T18:00:00Z"),
            ),
        )

        val days = buildWeeklyActivity(workouts, history, today, zone)

        assertEquals(DayActivityStatus.MISSED, days[0].status)
        assertEquals(0, deriveWeeklyCompliance(days).completed)
    }

    @Test
    fun `deriveTodayVolumeKg returns null when no matching log`() {
        val workout = aWorkout(id = "w-x")
        val history = listOf(aWorkoutLog(id = "l1").copy(workoutId = "w-y"))
        assertNull(deriveTodayVolumeKg(workout, history))
    }

    @Test
    fun `deriveTodayVolumeKg sums completed sets of matching log by id`() {
        val workout = aWorkout(id = "w1")
        val log = aWorkoutLog(id = "l1").copy(
            workoutId = "w1",
            exerciseLogs = listOf(
                anExerciseLog(sets = listOf(
                    aSetLog(actualWeightKg = 100f, actualReps = 5, completed = true),
                    aSetLog(actualWeightKg = 50f, actualReps = 10, completed = true),
                    aSetLog(actualWeightKg = 999f, actualReps = 999, completed = false),
                )),
            ),
        )
        assertEquals(1000.0, deriveTodayVolumeKg(workout, listOf(log)))
    }

    @Test
    fun `deriveTodayVolumeKg falls back to name match when workoutId is null`() {
        val workout = aWorkout(id = "w1", name = "Push Day")
        val log = aWorkoutLog(id = "l1").copy(
            workoutId = null,
            workoutName = "Push Day",
            exerciseLogs = listOf(anExerciseLog(sets = listOf(aSetLog(actualWeightKg = 20f, actualReps = 10)))),
        )
        assertEquals(200.0, deriveTodayVolumeKg(workout, listOf(log)))
    }

    @Test
    fun `deriveTodayVolumeKg picks most recent matching log`() {
        val workout = aWorkout(id = "w1")
        val older = aWorkoutLog(id = "old").copy(
            workoutId = "w1", loggedAt = Instant.parse("2026-04-01T10:00:00Z"),
            exerciseLogs = listOf(anExerciseLog(sets = listOf(aSetLog(actualWeightKg = 10f, actualReps = 1)))),
        )
        val newer = aWorkoutLog(id = "new").copy(
            workoutId = "w1", loggedAt = Instant.parse("2026-04-08T10:00:00Z"),
            exerciseLogs = listOf(anExerciseLog(sets = listOf(aSetLog(actualWeightKg = 30f, actualReps = 10)))),
        )
        assertEquals(300.0, deriveTodayVolumeKg(workout, listOf(older, newer)))
    }

    @Test
    fun `deriveTodayVolumeKg returns null when derived volume is zero`() {
        val workout = aWorkout(id = "w1")
        val log = aWorkoutLog(id = "l1").copy(
            workoutId = "w1",
            exerciseLogs = listOf(anExerciseLog(sets = listOf(
                aSetLog(actualWeightKg = null, actualReps = null, completed = true),
            ))),
        )
        assertNull(deriveTodayVolumeKg(workout, listOf(log)))
    }

    @Test
    fun `formatVolumeKg formats thousands and small values`() {
        assertEquals("12.4k kg", formatVolumeKg(12400.0))
        assertEquals("12k kg", formatVolumeKg(12000.0))
        assertEquals("840 kg", formatVolumeKg(840.0))
    }

    @Test
    fun `formatVolumeKg handles the 1000 boundary`() {
        assertEquals("1k kg", formatVolumeKg(1000.0))
        assertEquals("999 kg", formatVolumeKg(999.0))
    }

    @Test
    fun `deriveCategoryLabel breaks ties by first-encountered muscle group`() {
        // Back and Chest both appear once; Back is encountered first.
        val workout = aWorkout(id = "w1", exercises = listOf(exercise("Back"), exercise("Chest")))
        assertEquals("BACK", deriveCategoryLabel(workout))
    }

    @Test
    fun `deriveCategoryLabel returns dominant muscle group uppercased`() {
        val workout = aWorkout(id = "w1", exercises = listOf(
            exercise("Chest"), exercise("Chest"), exercise("Back"),
        ))
        assertEquals("CHEST", deriveCategoryLabel(workout))
    }

    @Test
    fun `deriveCategoryLabel falls back to WORKOUT when no muscle groups`() {
        val workout = aWorkout(id = "w1", exercises = listOf(exercise(null)))
        assertEquals("WORKOUT", deriveCategoryLabel(workout))
        assertEquals("WORKOUT", deriveCategoryLabel(aWorkout(id = "w2")))
    }
}
