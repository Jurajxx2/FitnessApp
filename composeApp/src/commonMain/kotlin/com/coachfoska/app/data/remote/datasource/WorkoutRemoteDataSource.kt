package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.SetLogDto
import com.coachfoska.app.data.remote.dto.SetLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.data.remote.dto.WorkoutLogInsertDto
import com.coachfoska.app.core.util.currentInstant
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator

class WorkoutRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getAssignedWorkouts(userId: String): List<WorkoutDto> {
        val global = supabase.postgrest["workouts"]
            .select {
                filter { exact("user_id", null); eq("is_active", true) }
                order("day_of_week", Order.ASCENDING)
            }.decodeList<WorkoutDto>()
        val userSpecific = supabase.postgrest["workouts"]
            .select {
                filter { eq("user_id", userId); eq("is_active", true) }
                order("day_of_week", Order.ASCENDING)
            }.decodeList<WorkoutDto>()
        return (global + userSpecific).distinctBy { it.id }
    }

    suspend fun getWorkoutById(workoutId: String): WorkoutDto =
        supabase.postgrest["workouts"]
            .select { filter { eq("id", workoutId) } }
            .decodeSingle<WorkoutDto>()

    suspend fun insertWorkoutLog(
        userId: String, workoutId: String?, workoutName: String,
        durationMinutes: Int, notes: String?,
    ): WorkoutLogDto {
        val payload = WorkoutLogInsertDto(
            userId = userId, workoutName = workoutName,
            durationMinutes = durationMinutes, loggedAt = currentInstant().toString(),
            workoutId = workoutId, notes = notes,
        )
        return supabase.postgrest["workout_logs"]
            .insert(payload) { select() }
            .decodeSingle<WorkoutLogDto>()
    }

    // Inserts one exercise log row; returns the persisted DTO with its assigned id.
    // Use a loop in the caller rather than batch to maintain a known id-per-input mapping.
    suspend fun insertExerciseLog(payload: ExerciseLogInsertDto): ExerciseLogDto =
        supabase.postgrest["exercise_logs"]
            .insert(payload) { select() }
            .decodeSingle<ExerciseLogDto>()

    suspend fun insertSetLogs(payloads: List<SetLogInsertDto>): List<SetLogDto> {
        if (payloads.isEmpty()) return emptyList()
        return supabase.postgrest["set_logs"]
            .insert(payloads) { select() }
            .decodeList<SetLogDto>()
    }

    suspend fun getWorkoutLogs(userId: String): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .select {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }.decodeList<WorkoutLogDto>()

    suspend fun getExerciseLogsForWorkouts(workoutLogIds: List<String>): List<ExerciseLogDto> {
        if (workoutLogIds.isEmpty()) return emptyList()
        return supabase.postgrest["exercise_logs"]
            .select { filter { filter("workout_log_id", FilterOperator.IN, workoutLogIds) } }
            .decodeList<ExerciseLogDto>()
    }

    suspend fun getSetLogsForExerciseLogs(exerciseLogIds: List<String>): List<SetLogDto> {
        if (exerciseLogIds.isEmpty()) return emptyList()
        return supabase.postgrest["set_logs"]
            .select {
                filter { filter("exercise_log_id", FilterOperator.IN, exerciseLogIds) }
                order("sort_order", Order.ASCENDING)
            }.decodeList<SetLogDto>()
    }
}
