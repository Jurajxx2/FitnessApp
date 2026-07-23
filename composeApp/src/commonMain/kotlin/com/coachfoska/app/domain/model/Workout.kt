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

/**
 * The single plan-level resolver for tracking type: an explicit stored [WorkoutExercise.logType]
 * is always authoritative; only fall back to name/reps inference when it is null (legacy plans).
 */
fun WorkoutExercise.resolvedLogType(): ExerciseLogType =
    logType ?: inferExerciseLogType(name = name, categoryName = muscleGroup, reps = reps)

/**
 * Whether this logged exercise is timed, decided purely from the *shape* of its sets — never
 * from the exercise name. True iff there is at least one set, none of the sets carry reps or
 * weight, and either (a) some set has a recorded [SetLog.actualDurationSeconds], or (b) as a
 * narrow legacy fallback for data recorded before actual_duration_seconds existed
 * (pre-20260710224911), no set has a duration but some set has [SetLog.actualRestSeconds]. This
 * is the only place the legacy actual_rest_seconds fallback is allowed to live.
 */
fun ExerciseLog.isTimed(): Boolean {
    if (sets.isEmpty()) return false
    if (sets.any { it.actualReps != null || it.actualWeightKg != null }) return false
    val hasDuration = sets.any { it.actualDurationSeconds != null }
    if (hasDuration) return true
    return sets.any { it.actualRestSeconds != null }
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

    // Duration part: only over sets that actually recorded a duration, so a completed set
    // missing its duration never inflates the printed count.
    val durations = done.mapNotNull { it.actualDurationSeconds }
    val durationPart = if (durations.isNotEmpty()) {
        when {
            durations.all { it == durations.first() } -> "${durations.size} × ${formatDuration(durations.first())}"
            else -> durations.joinToString(", ", transform = ::formatDuration)
        }
    } else null

    // Reps part: when there are timed sets in the mix, restrict to sets that actually carry
    // reps so a duration-only set never shows up as a stray "?" in the reps list. When nothing
    // is timed, fall back to the full completed-set list (preserves the weight-only "N sets" case).
    val repsSource = if (durations.isNotEmpty()) done.filter { it.actualReps != null } else done
    val reps = repsSource.map { it.actualReps }

    if (reps.isEmpty()) {
        // Purely timed: no completed set carries reps at all.
        return durationPart.orEmpty()
    }

    val repsPart = when {
        reps.all { it == null } -> "${repsSource.size} sets"
        reps.all { it == reps.first() } -> "${repsSource.size} × ${reps.first()}"
        else -> reps.map { it?.toString() ?: "?" }.joinToString(", ")
    }
    val maxWeight = repsSource.mapNotNull { it.actualWeightKg }.maxOrNull()
    val repsWithWeight = if (maxWeight != null) "$repsPart @ ${formatWeightKg(maxWeight)} kg" else repsPart

    return if (durationPart != null) "$repsWithWeight · $durationPart" else repsWithWeight
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
