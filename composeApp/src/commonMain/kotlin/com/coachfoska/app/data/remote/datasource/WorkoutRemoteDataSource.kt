package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.SetLogDto
import com.coachfoska.app.data.remote.dto.SetLogInsertDto
import com.coachfoska.app.data.remote.dto.UserWorkoutJoinDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutExerciseInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutFeedbackDto
import com.coachfoska.app.data.remote.dto.WorkoutInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.data.remote.dto.WorkoutLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutLogUpdateDto
import com.coachfoska.app.data.remote.dto.WorkoutUpdateDto
import com.coachfoska.app.core.util.currentInstant
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.Serializable

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
            status = "completed",
        )
        return supabase.postgrest["workout_logs"]
            .insert(payload) { select() }
            .decodeSingle<WorkoutLogDto>()
    }

    suspend fun insertInProgressWorkoutLog(
        userId: String,
        workoutId: String?,
        workoutName: String,
    ): WorkoutLogDto =
        supabase.postgrest["workout_logs"]
            .insert(
                WorkoutLogInsertDto(
                    userId = userId,
                    workoutName = workoutName,
                    durationMinutes = 0,
                    loggedAt = currentInstant().toString(),
                    workoutId = workoutId,
                    status = "in_progress",
                )
            ) { select() }
            .decodeSingle<WorkoutLogDto>()

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

    suspend fun insertSetLog(payload: SetLogInsertDto): SetLogDto =
        supabase.postgrest["set_logs"]
            .insert(payload) { select() }
            .decodeSingle<SetLogDto>()

    suspend fun updateSetLog(id: String, payload: SetLogInsertDto) {
        supabase.postgrest["set_logs"].update(payload) { filter { eq("id", id) } }
    }

    suspend fun deleteSetLog(id: String) {
        supabase.postgrest["set_logs"].delete { filter { eq("id", id) } }
    }

    suspend fun updateWorkoutLog(id: String, payload: WorkoutLogUpdateDto): WorkoutLogDto =
        supabase.postgrest["workout_logs"]
            .update(payload) {
                filter { eq("id", id) }
                select()
            }
            .decodeSingle<WorkoutLogDto>()

    /** Clears orphaned resumable sessions after the active session has been discarded. */
    suspend fun discardInProgressWorkoutLogs(userId: String): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .update(WorkoutLogUpdateDto(status = "discarded")) {
                filter {
                    eq("user_id", userId)
                    eq("status", "in_progress")
                }
                select()
            }
            .decodeList<WorkoutLogDto>()

    suspend fun getWorkoutLogs(userId: String): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .select {
                filter { eq("user_id", userId); eq("status", "completed") }
                order("logged_at", Order.DESCENDING)
            }.decodeList<WorkoutLogDto>()

    suspend fun getInProgressWorkoutLog(userId: String): WorkoutLogDto? =
        supabase.postgrest["workout_logs"]
            .select(columns = Columns.raw("*, exercise_logs(*, set_logs(*))")) {
                filter { eq("user_id", userId); eq("status", "in_progress") }
                order("logged_at", Order.DESCENDING)
                limit(1)
            }
            .decodeList<WorkoutLogDto>()
            .firstOrNull()

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

    suspend fun getWorkoutFeedback(userId: String): List<WorkoutFeedbackDto> =
        supabase.postgrest["workout_feedback"]
            .select {
                filter { eq("user_id", userId) }
                order("created_at", Order.ASCENDING)
            }.decodeList<WorkoutFeedbackDto>()

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
                    eq("status", "completed")
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
        // Fetch the ids of existing rows before touching anything — insert-before-delete prevents
        // irrecoverable data loss if the insert fails (network drop, constraint error, etc.).
        // NOTE: Postgrest has no client-side transaction. If the delete below fails after a
        // successful insert, the workout temporarily holds both old and new rows (duplicate rows,
        // not lost rows). A retry of updateUserWorkout converges to the correct final state.
        val oldIds = supabase.postgrest["workout_exercises"]
            .select(columns = Columns.raw("id")) {
                filter { eq("workout_id", workoutId) }
            }
            .decodeList<WorkoutExerciseIdDto>()
            .map { it.id }

        // Insert new rows first — confirmed in DB before any old row is destroyed.
        if (payloads.isNotEmpty()) supabase.postgrest["workout_exercises"].insert(payloads)

        // Delete only the previously-recorded old ids (skip if there were none).
        if (oldIds.isNotEmpty()) {
            supabase.postgrest["workout_exercises"].delete {
                filter { filter("id", FilterOperator.IN, oldIds) }
            }
        }
    }
}

// Minimal id-holder used by replaceWorkoutExercises for the insert-before-delete pattern.
@Serializable
private data class WorkoutExerciseIdDto(val id: String)
