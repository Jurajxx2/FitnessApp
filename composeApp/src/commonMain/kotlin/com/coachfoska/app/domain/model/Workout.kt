package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant

data class Workout(
    val id: String,
    val name: String,
    val dayOfWeek: DayOfWeek?,
    val durationMinutes: Int,
    val exercises: List<WorkoutExercise>,
    val notes: String? = null,
    val isActive: Boolean = true
)

data class WorkoutExercise(
    val id: String,
    val workoutId: String,
    val name: String,
    val muscleGroup: String?,
    val sets: Int,
    val reps: String,
    val restSeconds: Int,
    val tips: String?,
    val wgerExerciseId: Int? = null,
    val sortOrder: Int = 0
)

data class WorkoutLog(
    val id: String,
    val userId: String,
    val workoutId: String?,
    val workoutName: String,
    val durationMinutes: Int,
    val notes: String?,
    val exerciseLogs: List<ExerciseLog>,
    val loggedAt: Instant
)

data class ExerciseLog(
    val id: String,
    val workoutLogId: String,
    val exerciseName: String,
    val setsCompleted: Int,
    val repsCompleted: String?,
    val weightKg: Float?,
    val notes: String?
)

enum class DayOfWeek(val index: Int, val displayName: String) {
    MONDAY(0, "Monday"),
    TUESDAY(1, "Tuesday"),
    WEDNESDAY(2, "Wednesday"),
    THURSDAY(3, "Thursday"),
    FRIDAY(4, "Friday"),
    SATURDAY(5, "Saturday"),
    SUNDAY(6, "Sunday");

    companion object {
        fun fromIndex(index: Int?): DayOfWeek? = entries.firstOrNull { it.index == index }
    }
}
