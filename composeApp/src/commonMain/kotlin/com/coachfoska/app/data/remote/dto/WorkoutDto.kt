package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import kotlinx.datetime.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WorkoutDto(
    val id: String,
    val name: String,
    @SerialName("day_of_week") val dayOfWeek: Int? = null,
    @SerialName("duration_minutes") val durationMinutes: Int = 0,
    val notes: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("workout_exercises") val exercises: List<WorkoutExerciseDto> = emptyList()
) {
    fun toDomain(): Workout = Workout(
        id = id, name = name,
        dayOfWeek = DayOfWeek.fromIndex(dayOfWeek),
        durationMinutes = durationMinutes,
        exercises = exercises.map { it.toDomain() },
        notes = notes, isActive = isActive
    )
}

@Serializable
data class WorkoutExerciseDto(
    val id: String,
    @SerialName("workout_id") val workoutId: String,
    val name: String,
    @SerialName("muscle_group") val muscleGroup: String? = null,
    val sets: Int = 3,
    val reps: String = "10",
    @SerialName("rest_seconds") val restSeconds: Int = 60,
    val tips: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    @SerialName("sort_order") val sortOrder: Int = 0,
    @SerialName("exercise_id") val exerciseId: String? = null
) {
    fun toDomain(): WorkoutExercise = WorkoutExercise(
        id = id, workoutId = workoutId, name = name, muscleGroup = muscleGroup,
        sets = sets, reps = reps, restSeconds = restSeconds, tips = tips,
        videoUrl = videoUrl, sortOrder = sortOrder, exerciseId = exerciseId
    )
}

@Serializable
data class WorkoutLogDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("workout_id") val workoutId: String? = null,
    @SerialName("workout_name") val workoutName: String,
    @SerialName("duration_minutes") val durationMinutes: Int = 0,
    val notes: String? = null,
    @SerialName("logged_at") val loggedAt: String,
    @SerialName("exercise_logs") val exerciseLogs: List<ExerciseLogDto> = emptyList()
) {
    fun toDomain(): WorkoutLog = WorkoutLog(
        id = id, userId = userId, workoutId = workoutId,
        workoutName = workoutName, durationMinutes = durationMinutes, notes = notes,
        exerciseLogs = exerciseLogs.map { it.toDomain() },
        loggedAt = Instant.parse(loggedAt)
    )
}

@Serializable
data class WorkoutLogInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("workout_name") val workoutName: String,
    @SerialName("duration_minutes") val durationMinutes: Int,
    @SerialName("logged_at") val loggedAt: String,
    @SerialName("workout_id") val workoutId: String? = null,
    val notes: String? = null
)

// NOTE: sets_completed / reps_completed / weight_kg are legacy nullable columns kept for
// rollback. New writes set them to null. Reads use set_logs primarily and fall back to
// flat fields only when set_logs is empty.
@Serializable
data class ExerciseLogInsertDto(
    @SerialName("workout_log_id") val workoutLogId: String,
    @SerialName("exercise_name") val exerciseName: String,
    val notes: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    @SerialName("sets_completed") val setsCompleted: Int? = null,
    @SerialName("reps_completed") val repsCompleted: String? = null,
    @SerialName("weight_kg") val weightKg: Float? = null,
)

@Serializable
data class ExerciseLogDto(
    val id: String,
    @SerialName("workout_log_id") val workoutLogId: String,
    @SerialName("exercise_name") val exerciseName: String,
    @SerialName("sets_completed") val setsCompleted: Int = 0,
    @SerialName("reps_completed") val repsCompleted: String? = null,
    @SerialName("weight_kg") val weightKg: Float? = null,
    val notes: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    @SerialName("set_logs") val setLogs: List<SetLogDto> = emptyList(),
) {
    fun toDomain(): ExerciseLog = ExerciseLog(
        id = id,
        workoutLogId = workoutLogId,
        exerciseName = exerciseName,
        notes = notes,
        videoUrl = videoUrl,
        sets = if (setLogs.isNotEmpty()) setLogs.map { it.toDomain() }
               else synthesizeFromFlat(),
    )

    private fun synthesizeFromFlat(): List<SetLog> {
        if (setsCompleted <= 0) return emptyList()
        val parsedReps = parseLegacyReps(repsCompleted)
        return (1..setsCompleted).map { order ->
            SetLog(
                id = "$id-legacy-$order", exerciseLogId = id, sortOrder = order,
                targetReps = null, actualReps = parsedReps,
                targetWeightKg = null, actualWeightKg = weightKg,
                rpe = null, targetRestSeconds = null, actualRestSeconds = null,
                completed = true,
            )
        }
    }
}

private fun parseLegacyReps(value: String?): Int? {
    if (value.isNullOrBlank()) return null
    val firstSegment = value.substringBefore('-').trim()
    return if (firstSegment.all { it.isDigit() }) firstSegment.toIntOrNull() else null
}

@Serializable
data class SetLogDto(
    val id: String,
    @SerialName("exercise_log_id") val exerciseLogId: String,
    @SerialName("sort_order") val sortOrder: Int,
    @SerialName("target_reps") val targetReps: Int? = null,
    @SerialName("actual_reps") val actualReps: Int? = null,
    @SerialName("target_weight_kg") val targetWeightKg: Float? = null,
    @SerialName("actual_weight_kg") val actualWeightKg: Float? = null,
    val rpe: Int? = null,
    @SerialName("target_rest_seconds") val targetRestSeconds: Int? = null,
    @SerialName("actual_rest_seconds") val actualRestSeconds: Int? = null,
    val completed: Boolean = false,
) {
    fun toDomain(): SetLog = SetLog(
        id = id, exerciseLogId = exerciseLogId, sortOrder = sortOrder,
        targetReps = targetReps, actualReps = actualReps,
        targetWeightKg = targetWeightKg, actualWeightKg = actualWeightKg,
        rpe = rpe, targetRestSeconds = targetRestSeconds, actualRestSeconds = actualRestSeconds,
        completed = completed,
    )
}

@Serializable
data class SetLogInsertDto(
    @SerialName("exercise_log_id") val exerciseLogId: String,
    @SerialName("sort_order") val sortOrder: Int,
    @SerialName("target_reps") val targetReps: Int? = null,
    @SerialName("actual_reps") val actualReps: Int? = null,
    @SerialName("target_weight_kg") val targetWeightKg: Float? = null,
    @SerialName("actual_weight_kg") val actualWeightKg: Float? = null,
    val rpe: Int? = null,
    @SerialName("target_rest_seconds") val targetRestSeconds: Int? = null,
    @SerialName("actual_rest_seconds") val actualRestSeconds: Int? = null,
    val completed: Boolean = false,
)
