package com.coachfoska.app.domain.model

/** Per-day status for the Activity Hub weekly grid. Distinct from [CompletionStatus],
 *  which is shared with the Progress Dashboard and intentionally not extended. */
enum class DayActivityStatus {
    COMPLETED,
    TODAY,
    SCHEDULED,
    MISSED,
    REST,
}

data class WeekDayActivity(
    val dayOfWeek: DayOfWeek,
    val status: DayActivityStatus,
    val plannedWorkout: Workout? = null,
    val completedLog: WorkoutLog? = null,
)
