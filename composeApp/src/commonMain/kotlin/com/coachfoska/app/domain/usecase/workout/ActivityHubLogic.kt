package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.math.roundToInt

/**
 * Builds the 7-day (Mon–Sun) activity model for the Activity Hub weekly grid.
 *
 * Status precedence per weekday:
 *  - COMPLETED: a workout was logged on that weekday during the current week.
 *  - TODAY: the weekday is today (and not already completed).
 *  - MISSED / SCHEDULED: a workout is assigned to that weekday (past -> MISSED, today/future -> SCHEDULED).
 *  - REST: nothing assigned and nothing logged.
 */
fun buildWeeklyActivity(
    workouts: List<Workout>,
    history: List<WorkoutLog>,
    today: LocalDate,
    zone: TimeZone,
): List<WeekDayActivity> {
    val todayDow = today.dayOfWeek.ordinal
    val todayEpoch = today.toEpochDays()
    val weekStartEpoch = todayEpoch - todayDow

    // Map day-of-week index → assigned workout
    val workoutByDow: Map<Int, Workout> = workouts
        .mapNotNull { w -> w.dayOfWeek?.index?.let { it to w } }
        .toMap()

    // Map day-of-week index → the log for that day this week (latest if multiple)
    val logsByDow: Map<Int, WorkoutLog> = history
        .map { log -> log to log.loggedAt.toLocalDateTime(zone).date }
        .filter { (_, date) -> date.toEpochDays() in weekStartEpoch..todayEpoch }
        .groupBy { (_, date) -> date.dayOfWeek.ordinal }
        .mapValues { (dow, entries) ->
            val plannedWorkout = workoutByDow[dow]
            val matchingEntries = if (plannedWorkout != null) {
                entries.filter { (log, _) -> log.matchesWorkout(plannedWorkout) }
            } else {
                emptyList()
            }
            (matchingEntries.ifEmpty { entries })
                .maxBy { (log, _) -> log.loggedAt }
                .first
        }

    return DayOfWeek.entries.map { day ->
        val plannedWorkout = workoutByDow[day.index]
        val completedLog = logsByDow[day.index]
        val completedForDay = completedLog != null && (
            plannedWorkout == null || completedLog.matchesWorkout(plannedWorkout)
        )
        val status = when {
            completedForDay -> DayActivityStatus.COMPLETED
            day.index == todayDow -> DayActivityStatus.TODAY
            plannedWorkout != null && day.index < todayDow -> DayActivityStatus.MISSED
            plannedWorkout != null -> DayActivityStatus.SCHEDULED
            else -> DayActivityStatus.REST
        }
        WeekDayActivity(
            dayOfWeek = day,
            status = status,
            plannedWorkout = plannedWorkout,
            completedLog = completedLog,
        )
    }
}

data class WeeklyCompliance(
    val completed: Int,
    val assigned: Int,
)

/**
 * Counts completed assigned workouts for the current week. Unplanned workout logs still show in
 * the weekly grid, but they do not inflate plan compliance beyond what the coach assigned.
 */
fun deriveWeeklyCompliance(days: List<WeekDayActivity>): WeeklyCompliance {
    val assignedDays = days.filter { it.plannedWorkout != null }
    return WeeklyCompliance(
        completed = assignedDays.count { day ->
            val plannedWorkout = day.plannedWorkout ?: return@count false
            day.completedLog?.matchesWorkout(plannedWorkout) == true
        },
        assigned = assignedDays.size,
    )
}

fun WorkoutLog.matchesWorkout(workout: Workout): Boolean {
    return workoutId == workout.id || (workoutId == null && workoutName == workout.name)
}

/**
 * Estimates today's total training volume (kg) from the most recent logged session
 * matching [todayWorkout] (by id, or by name when the log has no workoutId).
 * Returns null when there is no workout, no matching log, or the volume is zero.
 */
fun deriveTodayVolumeKg(todayWorkout: Workout?, history: List<WorkoutLog>): Double? {
    if (todayWorkout == null) return null
    val matching = history
        .filter { it.workoutId == todayWorkout.id || (it.workoutId == null && it.workoutName == todayWorkout.name) }
        .maxByOrNull { it.loggedAt }
        ?: return null
    val volume = matching.exerciseLogs
        .flatMap { it.sets }
        .filter { it.completed }
        .sumOf { (it.actualWeightKg?.toDouble() ?: 0.0) * (it.actualReps ?: 0) }
    return if (volume <= 0.0) null else volume
}

/** Formats a kg volume: "12.4k kg" for >= 1000, "840 kg" otherwise. */
fun formatVolumeKg(kg: Double): String {
    return if (kg >= 1000) {
        val thousands = (kg / 100.0).roundToInt() / 10.0 // one decimal place
        val text = if (thousands % 1.0 == 0.0) thousands.toInt().toString() else thousands.toString()
        "${text}k kg"
    } else {
        "${kg.roundToInt()} kg"
    }
}

/** Derives a short category badge from the workout's dominant muscle group, uppercased. */
fun deriveCategoryLabel(workout: Workout): String {
    val dominant = workout.exercises
        .mapNotNull { it.muscleGroup }
        .filter { it.isNotBlank() }
        .groupingBy { it }
        .eachCount()
        .maxByOrNull { it.value }
        ?.key
    return dominant?.uppercase() ?: "WORKOUT"
}
