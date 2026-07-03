package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.SetLogDto
import com.coachfoska.app.data.remote.dto.SetLogInsertDto
import com.coachfoska.app.data.remote.dto.UserWorkoutJoinDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutExerciseInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.data.remote.dto.WorkoutLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutUpdateDto
import com.coachfoska.app.core.util.currentInstant
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator

class WorkoutRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getAssignedWorkouts(userId: String): List<WorkoutDto> {
        val global = supabase.postgrest["workouts"]
            .select(columns = Columns.raw("*, workout_exercises(*)")) {
                filter { exact("user_id", null); eq("is_active", true) }
                order("day_of_week", Order.ASCENDING)
            }.decodeList<WorkoutDto>()

        val legacyUserSpecific = supabase.postgrest["workouts"]
            .select(columns = Columns.raw("*, workout_exercises(*)")) {
                filter { eq("user_id", userId); eq("is_active", true) }
                order("day_of_week", Order.ASCENDING)
            }.decodeList<WorkoutDto>()

        val viaJoinTable = supabase.postgrest["user_workouts"]
            .select(columns = Columns.raw("workout_id, workouts(*, workout_exercises(*))")) {
                filter { eq("user_id", userId) }
            }
            .decodeList<UserWorkoutJoinDto>()
            .mapNotNull { it.workouts }
            .filter { it.isActive }

        val ownPlans = supabase.postgrest["workouts"]
            .select(columns = Columns.raw("*, workout_exercises(*)")) {
                filter { eq("owner_user_id", userId); eq("is_active", true) }
                order("day_of_week", Order.ASCENDING)
            }.decodeList<WorkoutDto>()

        return (global + legacyUserSpecific + viaJoinTable + ownPlans).distinctBy { it.id }
    }

    suspend fun getAllWorkouts(): List<WorkoutDto> =
        supabase.postgrest["workouts"]
            .select(columns = Columns.raw("*, workout_exercises(*)")) {
                filter { exact("owner_user_id", null); eq("is_active", true) }
                order("day_of_week", Order.ASCENDING)
            }.decodeList<WorkoutDto>()

    suspend fun getWorkoutById(workoutId: String): WorkoutDto =
        supabase.postgrest["workouts"]
            .select(columns = Columns.raw("*, workout_exercises(*)")) {
                filter { eq("id", workoutId) }
            }
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

    suspend fun getLastExerciseLogs(
        userId: String,
        exerciseNames: List<String>
    ): Map<String, List<SetLogDto>> {
        if (exerciseNames.isEmpty()) return emptyMap()

        val workoutLogs = getWorkoutLogs(userId)

        if (workoutLogs.isEmpty()) return emptyMap()

        val exerciseLogs = supabase.postgrest["exercise_logs"]
            .select {
                filter {
                    filter("workout_log_id", FilterOperator.IN, workoutLogs.map { it.id })
                    filter("exercise_name", FilterOperator.IN, exerciseNames)
                }
            }.decodeList<ExerciseLogDto>()

        if (exerciseLogs.isEmpty()) return emptyMap()

        val workoutLogOrder = workoutLogs.mapIndexed { index, wl -> wl.id to index }.toMap()

        val mostRecentByExercise = exerciseLogs
            .groupBy { it.exerciseName }
            .mapValues { (_, logs) ->
                logs.minByOrNull { workoutLogOrder[it.workoutLogId] ?: Int.MAX_VALUE }
            }
            .filterValues { it != null }
            .mapValues { it.value!! }

        val exerciseLogIds = mostRecentByExercise.values.map { it.id }
        val setLogs = getSetLogsForExerciseLogs(exerciseLogIds)
        val setsByExerciseLogId = setLogs.groupBy { it.exerciseLogId }

        return mostRecentByExercise.mapValues { (_, exerciseLog) ->
            setsByExerciseLogId[exerciseLog.id]
                ?.sortedBy { it.sortOrder }
                .orEmpty()
        }
    }

    suspend fun getExerciseLogHistory(
        userId: String,
        exerciseName: String
    ): List<Pair<ExerciseLogDto, String>> {
        val workoutLogs = getWorkoutLogs(userId)

        if (workoutLogs.isEmpty()) return emptyList()

        val exerciseLogs = supabase.postgrest["exercise_logs"]
            .select {
                filter {
                    filter("workout_log_id", FilterOperator.IN, workoutLogs.map { it.id })
                    eq("exercise_name", exerciseName)
                }
            }.decodeList<ExerciseLogDto>()

        if (exerciseLogs.isEmpty()) return emptyList()

        val setLogs = getSetLogsForExerciseLogs(exerciseLogs.map { it.id })
        val setsByExerciseLogId = setLogs.groupBy { it.exerciseLogId }

        val logDates = workoutLogs.associate { it.id to it.loggedAt }

        return exerciseLogs
            .map { el ->
                el.copy(setLogs = setsByExerciseLogId[el.id].orEmpty().sortedBy { it.sortOrder }) to
                    (logDates[el.workoutLogId] ?: "")
            }
            .sortedByDescending { it.second }
    }

    suspend fun getWorkoutLogsSince(
        userId: String,
        sinceIso: String
    ): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .select {
                filter {
                    eq("user_id", userId)
                    gte("logged_at", sinceIso)
                }
                order("logged_at", Order.ASCENDING)
            }.decodeList<WorkoutLogDto>()

    suspend fun insertWorkout(payload: WorkoutInsertDto): WorkoutDto =
        supabase.postgrest["workouts"].insert(payload) { select() }.decodeSingle<WorkoutDto>()

    suspend fun updateWorkout(workoutId: String, payload: WorkoutUpdateDto) {
        supabase.postgrest["workouts"].update(payload) { filter { eq("id", workoutId) } }
    }

    suspend fun deleteWorkout(workoutId: String) {
        supabase.postgrest["workouts"].delete { filter { eq("id", workoutId) } }
    }

    suspend fun replaceWorkoutExercises(workoutId: String, payloads: List<WorkoutExerciseInsertDto>) {
        supabase.postgrest["workout_exercises"].delete { filter { eq("workout_id", workoutId) } }
        if (payloads.isNotEmpty()) supabase.postgrest["workout_exercises"].insert(payloads)
    }
}
