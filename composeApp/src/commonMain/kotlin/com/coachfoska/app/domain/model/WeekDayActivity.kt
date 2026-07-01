package com.coachfoska.app.domain.model

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
