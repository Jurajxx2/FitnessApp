package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.data.remote.dto.WorkoutLogInsertDto
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
        val payload = WorkoutLogInsertDto(
            userId = userId,
            workoutName = workoutName,
            durationMinutes = durationMinutes,
            loggedAt = currentInstant().toString(),
            workoutId = workoutId,
            notes = notes
        )
        return supabase.postgrest["workout_logs"]
            .insert(payload) { select() }
            .decodeSingle<WorkoutLogDto>()
    }

    suspend fun insertExerciseLogs(logs: List<ExerciseLogInsertDto>): List<ExerciseLogDto> =
        supabase.postgrest["exercise_logs"]
            .insert(logs) { select() }
            .decodeList<ExerciseLogDto>()

    suspend fun getWorkoutHistory(userId: String): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .select {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }
            .decodeList<WorkoutLogDto>()
}
