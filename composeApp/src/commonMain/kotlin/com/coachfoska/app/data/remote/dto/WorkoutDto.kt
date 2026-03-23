package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseLog
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
        id = id,
        name = name,
        dayOfWeek = DayOfWeek.fromIndex(dayOfWeek),
        durationMinutes = durationMinutes,
        exercises = exercises.map { it.toDomain() },
        notes = notes,
        isActive = isActive
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
    @SerialName("wger_exercise_id") val wgerExerciseId: Int? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    @SerialName("sort_order") val sortOrder: Int = 0
) {
    fun toDomain(): WorkoutExercise = WorkoutExercise(
        id = id,
        workoutId = workoutId,
        name = name,
        muscleGroup = muscleGroup,
        sets = sets,
        reps = reps,
        restSeconds = restSeconds,
        tips = tips,
        wgerExerciseId = wgerExerciseId,
        videoUrl = videoUrl,
        sortOrder = sortOrder
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
        id = id,
        userId = userId,
        workoutId = workoutId,
        workoutName = workoutName,
        durationMinutes = durationMinutes,
        notes = notes,
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

@Serializable
data class ExerciseLogInsertDto(
    @SerialName("workout_log_id") val workoutLogId: String,
    @SerialName("exercise_name") val exerciseName: String,
    @SerialName("sets_completed") val setsCompleted: Int,
    @SerialName("reps_completed") val repsCompleted: String? = null,
    @SerialName("weight_kg") val weightKg: Float? = null,
    val notes: String? = null,
    @SerialName("video_url") val videoUrl: String? = null
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
    @SerialName("video_url") val videoUrl: String? = null
) {
    fun toDomain(): ExerciseLog = ExerciseLog(
        id = id,
        workoutLogId = workoutLogId,
        exerciseName = exerciseName,
        setsCompleted = setsCompleted,
        repsCompleted = repsCompleted,
        weightKg = weightKg,
        notes = notes,
        videoUrl = videoUrl
    )
}
