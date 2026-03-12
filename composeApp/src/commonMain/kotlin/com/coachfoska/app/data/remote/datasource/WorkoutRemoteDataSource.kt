package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import com.coachfoska.app.core.util.currentInstant

class WorkoutRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getAssignedWorkouts(userId: String): List<WorkoutDto> {
        val global = supabase.postgrest["workouts"]
            .select {
                filter {
                    exact("user_id", null)
                    eq("is_active", true)
                }
                order("day_of_week", Order.ASCENDING)
            }
            .decodeList<WorkoutDto>()

        val userSpecific = supabase.postgrest["workouts"]
            .select {
                filter {
                    eq("user_id", userId)
                    eq("is_active", true)
                }
                order("day_of_week", Order.ASCENDING)
            }
            .decodeList<WorkoutDto>()

        return (global + userSpecific).distinctBy { it.id }
    }

    suspend fun getWorkoutById(workoutId: String): WorkoutDto =
        supabase.postgrest["workouts"]
            .select {
                filter { eq("id", workoutId) }
            }
            .decodeSingle<WorkoutDto>()

    suspend fun insertWorkoutLog(
        userId: String,
        workoutId: String?,
        workoutName: String,
        durationMinutes: Int,
        notes: String?
    ): WorkoutLogDto {
        val payload = buildMap<String, Any?> {
            put("user_id", userId)
            put("workout_name", workoutName)
            put("duration_minutes", durationMinutes)
            put("logged_at", currentInstant().toString())
            if (workoutId != null) put("workout_id", workoutId)
            if (notes != null) put("notes", notes)
        }
        return supabase.postgrest["workout_logs"]
            .insert(payload)
            .decodeSingle<WorkoutLogDto>()
    }

    suspend fun insertExerciseLogs(logs: List<Map<String, Any?>>): List<ExerciseLogDto> =
        supabase.postgrest["exercise_logs"]
            .insert(logs)
            .decodeList<ExerciseLogDto>()

    suspend fun getWorkoutHistory(userId: String): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .select {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }
            .decodeList<WorkoutLogDto>()
}
