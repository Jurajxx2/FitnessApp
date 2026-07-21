package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant

enum class WorkoutSource { COACH, USER }

data class Workout(
    val id: String,
    val name: String,
    val dayOfWeek: DayOfWeek?,
    val durationMinutes: Int,
    val exercises: List<WorkoutExercise>,
    val notes: String? = null,
    val isActive: Boolean = true,
    val source: WorkoutSource = WorkoutSource.COACH,
    val ownerUserId: String? = null,
    val forkedFromWorkoutId: String? = null,
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
    val videoUrl: String? = null,
    val sortOrder: Int = 0,
    val exerciseId: String? = null,
    /** Explicit tracking model for new plans. Null keeps the legacy name/reps inference. */
    val logType: ExerciseLogType? = null,
    /** Per-set goal for timed exercises; null for rep-based movements and legacy plans. */
    val targetDurationSeconds: Int? = null,
    val substitutedFromExerciseId: String? = null,
    val substitutedFromName: String? = null,
)

data class WorkoutExerciseDraft(
    val exerciseId: String?,
    val name: String,
    val muscleGroup: String?,
    val sets: Int,
    val reps: String,
    val restSeconds: Int,
    val tips: String? = null,
    val logType: ExerciseLogType? = null,
    val targetDurationSeconds: Int? = null,
    val substitutedFromExerciseId: String? = null,
    val substitutedFromName: String? = null,
)

data class WorkoutDraft(
    val name: String,
    val dayOfWeek: DayOfWeek?,
    val notes: String?,
    val exercises: List<WorkoutExerciseDraft>,
)

data class WorkoutLog(
    val id: String,
    val userId: String,
    val workoutId: String?,
    val workoutName: String,
    val durationMinutes: Int,
    val notes: String?,
    val exerciseLogs: List<ExerciseLog>,
    val loggedAt: Instant,
    val status: String = "completed",
    val feedback: List<WorkoutFeedback> = emptyList(),
)

data class ExerciseLog(
    val id: String,
    val workoutLogId: String,
    val exerciseName: String,
    val notes: String?,
    /** The parent workout session timestamp, needed for per-exercise history and charts. */
    val loggedAt: Instant? = null,
    val videoUrl: String? = null,
    val exerciseId: String? = null,
    val substitutedFromExerciseId: String? = null,
    val substitutedFromName: String? = null,
    val sets: List<SetLog> = emptyList(),
    val feedback: List<WorkoutFeedback> = emptyList(),
) {
    val setsCompletedCount: Int get() = sets.count { it.completed }
    val summaryLine: String get() = buildSummaryLine(sets)
}

data class WorkoutFeedback(
    val id: String,
    val userId: String,
    val coachId: String,
    val workoutLogId: String?,
    val exerciseLogId: String?,
    val body: String,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class SetLog(
    val id: String,
    val exerciseLogId: String,
    val sortOrder: Int,
    val targetReps: Int?,
    val actualReps: Int?,
    val targetWeightKg: Float?,
    val actualWeightKg: Float?,
    val rpe: Int?,
    val targetRestSeconds: Int?,
    val actualRestSeconds: Int?,
    val completed: Boolean,
    /** Duration of a timed exercise; intentionally separate from the rest after a set. */
    val actualDurationSeconds: Int? = null,
)

data class SavedSetRef(
    val exerciseLogId: String,
    val setLogId: String,
)

private fun buildSummaryLine(sets: List<SetLog>): String {
    val done = sets.filter { it.completed }
    if (done.isEmpty()) return ""
    val reps = done.map { it.actualReps }
    val durations = done.mapNotNull { it.actualDurationSeconds }
    if (reps.all { it == null } && durations.isNotEmpty()) {
        val durationPart = when {
            durations.all { it == durations.first() } -> "${done.size} × ${formatDuration(durations.first())}"
            else -> durations.joinToString(", ", transform = ::formatDuration)
        }
        return durationPart
    }
    val repsPart = when {
        reps.all { it == null } -> "${done.size} sets"
        reps.all { it == reps.first() } -> "${done.size} × ${reps.first()}"
        else -> reps.map { it?.toString() ?: "?" }.joinToString(", ")
    }
    val maxWeight = done.mapNotNull { it.actualWeightKg }.maxOrNull()
    return if (maxWeight != null) "$repsPart @ ${formatWeightKg(maxWeight)} kg" else repsPart
}

fun formatDuration(totalSeconds: Int): String =
    "${(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}"

// Formats a weight value for display: drops trailing ".0" on whole numbers (60.0f → "60"),
// keeps fractional precision otherwise (60.5f → "60.5").
fun formatWeightKg(value: Float): String {
    val whole = value.toLong()
    return if (whole.toFloat() == value) whole.toString() else value.toString()
}

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
