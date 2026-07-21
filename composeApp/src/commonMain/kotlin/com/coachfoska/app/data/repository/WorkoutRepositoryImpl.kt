package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.SetLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutExerciseInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutLogUpdateDto
import com.coachfoska.app.data.remote.dto.WorkoutUpdateDto
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.PRType
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.RecordDetail
import com.coachfoska.app.domain.model.RecordEntry
import com.coachfoska.app.domain.model.RecordValue
import com.coachfoska.app.domain.model.SavedSetRef
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutDraft
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.model.inferExerciseLogType
import com.coachfoska.app.domain.repository.WorkoutRepository
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

class WorkoutRepositoryImpl(
    private val workoutDataSource: WorkoutRemoteDataSource
) : WorkoutRepository {

    override suspend fun getAssignedWorkouts(userId: String): Result<List<Workout>> = runCatching {
        shadowForks(workoutDataSource.getAssignedWorkouts(userId).map { it.toDomain() })
    }

    override suspend fun getAllWorkouts(): Result<List<Workout>> = runCatching {
        workoutDataSource.getAllWorkouts().map { it.toDomain() }
    }

    override suspend fun getWorkoutById(workoutId: String): Result<Workout> = runCatching {
        workoutDataSource.getWorkoutById(workoutId).toDomain()
    }

    override suspend fun logWorkout(
        userId: String,
        workoutId: String?,
        workoutName: String,
        durationMinutes: Int,
        notes: String?,
        exerciseLogs: List<ExerciseLog>,
    ): Result<WorkoutLog> = runCatching {
        val logDto = workoutDataSource.insertWorkoutLog(
            userId, workoutId, workoutName, durationMinutes, notes
        )

        // Insert each exercise log in order so we have a known id-per-input mapping.
        val insertedExerciseLogs = exerciseLogs.map { exerciseLog ->
            val exerciseInserted = workoutDataSource.insertExerciseLog(
                ExerciseLogInsertDto(
                    workoutLogId = logDto.id,
                    exerciseName = exerciseLog.exerciseName,
                    notes = exerciseLog.notes,
                    videoUrl = exerciseLog.videoUrl,
                    exerciseId = exerciseLog.exerciseId,
                    substitutedFromExerciseId = exerciseLog.substitutedFromExerciseId,
                    substitutedFromName = exerciseLog.substitutedFromName,
                    // legacy columns left null on new writes
                )
            )
            exerciseInserted to exerciseLog.sets
        }

        // Build a flat set-log payload list, with the right exercise_log_id for each.
        val setPayloads = insertedExerciseLogs.flatMap { (parent, sets) ->
            sets.map { s ->
                SetLogInsertDto(
                    exerciseLogId = parent.id,
                    sortOrder = s.sortOrder,
                    targetReps = s.targetReps, actualReps = s.actualReps,
                    targetWeightKg = s.targetWeightKg, actualWeightKg = s.actualWeightKg,
                    rpe = s.rpe,
                    targetRestSeconds = s.targetRestSeconds,
                    actualRestSeconds = s.actualRestSeconds,
                    completed = s.completed,
                    actualDurationSeconds = s.actualDurationSeconds,
                )
            }
        }

        val insertedSetLogs = workoutDataSource.insertSetLogs(setPayloads)

        // Re-attach set logs to exercise logs by exercise_log_id, then to the workout log.
        val setsByExerciseId = insertedSetLogs.groupBy { it.exerciseLogId }
        val finalExerciseDtos = insertedExerciseLogs.map { (parent, _) ->
            parent.copy(setLogs = setsByExerciseId[parent.id].orEmpty().sortedBy { it.sortOrder })
        }
        logDto.copy(exerciseLogs = finalExerciseDtos).toDomain()
    }

    override suspend fun getWorkoutHistory(userId: String): Result<List<WorkoutLog>> = runCatching {
        val workoutLogs = workoutDataSource.getWorkoutLogs(userId)
        if (workoutLogs.isEmpty()) return@runCatching emptyList()

        val exerciseLogs = workoutDataSource.getExerciseLogsForWorkouts(workoutLogs.map { it.id })
        val setLogs = workoutDataSource.getSetLogsForExerciseLogs(exerciseLogs.map { it.id })
        val feedback = workoutDataSource.getWorkoutFeedback(userId)

        val setsByExerciseId = setLogs.groupBy { it.exerciseLogId }
        val feedbackByWorkoutLogId = feedback
            .filter { it.workoutLogId != null }
            .groupBy { it.workoutLogId!! }
        val feedbackByExerciseLogId = feedback
            .filter { it.exerciseLogId != null }
            .groupBy { it.exerciseLogId!! }
        val exercisesByWorkoutId = exerciseLogs
            .map {
                it.copy(
                    setLogs = setsByExerciseId[it.id].orEmpty().sortedBy { s -> s.sortOrder },
                    feedback = feedbackByExerciseLogId[it.id].orEmpty(),
                )
            }
            .groupBy { it.workoutLogId }

        workoutLogs.map { wl ->
            wl.copy(
                exerciseLogs = exercisesByWorkoutId[wl.id].orEmpty(),
                feedback = feedbackByWorkoutLogId[wl.id].orEmpty(),
            ).toDomain()
        }
    }

    override suspend fun getLastLogsForExercises(
        userId: String,
        exerciseNames: List<String>
    ): Result<Map<String, List<SetLog>>> = runCatching {
        workoutDataSource.getLastExerciseLogs(userId, exerciseNames)
            .mapValues { (_, setLogDtos) -> setLogDtos.map { it.toDomain() } }
    }

    override suspend fun getExerciseHistory(
        userId: String,
        exerciseName: String
    ): Result<List<ExerciseLog>> = runCatching {
        workoutDataSource.getExerciseLogHistory(userId, exerciseName)
            .map { (dto, loggedAt) ->
                dto.toDomain(loggedAt = runCatching { Instant.parse(loggedAt) }.getOrNull())
            }
    }

    override suspend fun getExerciseRecords(
        userId: String,
        exerciseName: String
    ): Result<ExerciseRecords> = runCatching {
        val history = workoutDataSource.getExerciseLogHistory(userId, exerciseName)
        if (history.isEmpty()) return@runCatching ExerciseRecords(null, null, null, null)

        val tz = TimeZone.currentSystemDefault()
        var heaviestWeight: RecordEntry? = null
        var mostRepsAtWeight: RecordEntry? = null
        var highest1RM: RecordEntry? = null
        var highestVolume: RecordEntry? = null
        var maxWeightKg = 0f
        var maxReps = 0
        var max1RMKg = 0f
        var maxVolumeKg = 0f
        var longestDuration: RecordEntry? = null
        var maxDurationSeconds = 0
        val isTimedExercise = inferExerciseLogType(exerciseName) == ExerciseLogType.TIME

        for ((exerciseLogDto, loggedAtStr) in history) {
            val date = try {
                Instant.parse(loggedAtStr).toLocalDateTime(tz).date
            } catch (_: Exception) { continue }

            val sets = exerciseLogDto.setLogs.filter { it.completed }
            if (sets.isEmpty()) continue

            // Session volume
            val sessionVolume = sets.sumOf { s ->
                ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
            }.toFloat()
            if (sessionVolume > maxVolumeKg) {
                maxVolumeKg = sessionVolume
                highestVolume = RecordEntry(
                    value = RecordValue.Weight(sessionVolume),
                    detail = RecordDetail.Sets(sets.size),
                    date = date
                )
            }

            for (s in sets) {
                val reps = s.actualReps
                val weight = s.actualWeightKg
                val durationSeconds = s.actualDurationSeconds
                    ?: s.actualRestSeconds?.takeIf { isTimedExercise }

                if (durationSeconds != null && durationSeconds > maxDurationSeconds) {
                    maxDurationSeconds = durationSeconds
                    longestDuration = RecordEntry(
                        value = RecordValue.Duration(durationSeconds),
                        detail = RecordDetail.LongestTimedSet,
                        date = date,
                    )
                }

                // Rep records are valid for bodyweight exercises too. The old implementation
                // skipped them entirely because it required an entered weight.
                if (reps != null && reps > maxReps) {
                    maxReps = reps
                    mostRepsAtWeight = RecordEntry(
                        value = RecordValue.Reps(reps),
                        detail = weight?.let { RecordDetail.WeightAndReps(it, reps) } ?: RecordDetail.RepsOnly(reps),
                        date = date,
                    )
                }

                val w = weight ?: continue
                val r = reps ?: continue

                if (w > maxWeightKg) {
                    maxWeightKg = w
                    heaviestWeight = RecordEntry(
                        value = RecordValue.Weight(w),
                        detail = RecordDetail.WeightAndReps(w, r),
                        date = date,
                    )
                }

                if (r in 1..30) {
                    val estimated1RM = w * (1f + r / 30f)
                    if (estimated1RM > max1RMKg) {
                        max1RMKg = estimated1RM
                        highest1RM = RecordEntry(
                            value = RecordValue.Weight(estimated1RM),
                            detail = RecordDetail.OneRmSource(w, r),
                            date = date,
                        )
                    }
                }
            }
        }

        ExerciseRecords(heaviestWeight, mostRepsAtWeight, highest1RM, highestVolume, longestDuration)
    }

    override suspend fun getRecentPersonalRecords(
        userId: String,
        limit: Int
    ): Result<List<PersonalRecord>> = runCatching {
        val workoutLogs = workoutDataSource.getWorkoutLogs(userId)
        if (workoutLogs.isEmpty()) return@runCatching emptyList()

        val exerciseLogs = workoutDataSource.getExerciseLogsForWorkouts(workoutLogs.map { it.id })
        val setLogs = workoutDataSource.getSetLogsForExerciseLogs(exerciseLogs.map { it.id })
        val setsByExerciseId = setLogs.groupBy { it.exerciseLogId }

        val bestWeightByExercise = mutableMapOf<String, Float>()
        val prs = mutableListOf<PersonalRecord>()

        val logDateMap = workoutLogs.associate { it.id to it.loggedAt }
        val sortedExerciseLogs = exerciseLogs.sortedBy { logDateMap[it.workoutLogId] }

        for (el in sortedExerciseLogs) {
            val sets = setsByExerciseId[el.id].orEmpty().filter { it.completed }
            val loggedAt = logDateMap[el.workoutLogId] ?: continue

            for (s in sets) {
                val w = s.actualWeightKg ?: continue
                val prevBest = bestWeightByExercise[el.exerciseName]
                if (prevBest == null || w > prevBest) {
                    bestWeightByExercise[el.exerciseName] = w
                    if (prevBest != null) {
                        prs.add(PersonalRecord(
                            type = PRType.HEAVIEST_WEIGHT,
                            exerciseName = el.exerciseName,
                            value = "${formatWeightKg(w)}kg x ${s.actualReps ?: "?"}",
                            previousBest = "${formatWeightKg(prevBest)}kg",
                            achievedAt = Instant.parse(loggedAt),
                        ))
                    }
                }
            }
        }

        prs.sortedByDescending { it.achievedAt }.take(limit)
    }

    override suspend fun getWorkoutCountByWeek(
        userId: String,
        since: LocalDate
    ): Result<List<WeeklyCount>> = runCatching {
        val logs = workoutDataSource.getWorkoutLogsSince(userId, "${since}T00:00:00Z")
        val tz = TimeZone.currentSystemDefault()

        logs.groupBy { dto ->
            val localDate = Instant.parse(dto.loggedAt).toLocalDateTime(tz).date
            val daysSinceMonday = localDate.dayOfWeek.ordinal // Monday=0
            LocalDate.fromEpochDays(localDate.toEpochDays() - daysSinceMonday)
        }.map { (weekStart, logsInWeek) ->
            WeeklyCount(weekStart = weekStart, count = logsInWeek.size)
        }.sortedBy { it.weekStart }
    }

    override suspend fun getCurrentStreak(userId: String): Result<Int> = runCatching {
        val tz = TimeZone.currentSystemDefault()
        val today = currentInstant().toLocalDateTime(tz).date
        val todayDaysSinceMonday = today.dayOfWeek.ordinal
        val thisWeekStart = LocalDate.fromEpochDays(today.toEpochDays() - todayDaysSinceMonday)

        val since = LocalDate.fromEpochDays(thisWeekStart.toEpochDays() - 364)
        val weeklyCounts = getWorkoutCountByWeek(userId, since).getOrElse { return@runCatching 0 }

        val weekSet = weeklyCounts.filter { it.count > 0 }.map { it.weekStart }.toSet()

        var streak = 0
        var checkWeek = thisWeekStart
        while (checkWeek in weekSet) {
            streak++
            checkWeek = LocalDate.fromEpochDays(checkWeek.toEpochDays() - 7)
        }
        streak
    }

    override suspend fun createUserWorkout(
        userId: String,
        draft: WorkoutDraft,
        forkedFromWorkoutId: String?,
    ): Result<Workout> = runCatching {
        val workoutPayload = WorkoutInsertDto(
            name = draft.name,
            dayOfWeek = draft.dayOfWeek?.index,
            notes = draft.notes,
            ownerUserId = userId,
            userId = userId,
            forkedFromWorkoutId = forkedFromWorkoutId,
        )
        val workoutDto = workoutDataSource.insertWorkout(workoutPayload)
        val exercisePayloads = draft.exercises.mapIndexed { index, ex ->
            WorkoutExerciseInsertDto(
                workoutId = workoutDto.id,
                name = ex.name,
                muscleGroup = ex.muscleGroup,
                sets = ex.sets,
                reps = ex.reps,
                restSeconds = ex.restSeconds,
                tips = ex.tips,
                sortOrder = index,
                exerciseId = ex.exerciseId,
                logType = ex.logType?.toDatabaseValue(),
                targetDurationSeconds = ex.targetDurationSeconds,
                substitutedFromExerciseId = ex.substitutedFromExerciseId,
                substitutedFromName = ex.substitutedFromName,
            )
        }
        workoutDataSource.replaceWorkoutExercises(workoutDto.id, exercisePayloads)
        workoutDataSource.getWorkoutById(workoutDto.id).toDomain()
    }

    override suspend fun updateUserWorkout(workoutId: String, draft: WorkoutDraft): Result<Workout> = runCatching {
        val updatePayload = WorkoutUpdateDto(
            name = draft.name,
            dayOfWeek = draft.dayOfWeek?.index,
            notes = draft.notes,
        )
        workoutDataSource.updateWorkout(workoutId, updatePayload)
        val exercisePayloads = draft.exercises.mapIndexed { index, ex ->
            WorkoutExerciseInsertDto(
                workoutId = workoutId,
                name = ex.name,
                muscleGroup = ex.muscleGroup,
                sets = ex.sets,
                reps = ex.reps,
                restSeconds = ex.restSeconds,
                tips = ex.tips,
                sortOrder = index,
                exerciseId = ex.exerciseId,
                logType = ex.logType?.toDatabaseValue(),
                targetDurationSeconds = ex.targetDurationSeconds,
                substitutedFromExerciseId = ex.substitutedFromExerciseId,
                substitutedFromName = ex.substitutedFromName,
            )
        }
        workoutDataSource.replaceWorkoutExercises(workoutId, exercisePayloads)
        workoutDataSource.getWorkoutById(workoutId).toDomain()
    }

    override suspend fun deleteUserWorkout(workoutId: String): Result<Unit> = runCatching {
        workoutDataSource.deleteWorkout(workoutId)
    }

    override suspend fun startWorkoutSession(
        userId: String,
        workoutId: String?,
        workoutName: String,
    ): Result<String> = runCatching {
        workoutDataSource.insertInProgressWorkoutLog(userId, workoutId, workoutName).id
    }

    override suspend fun saveSetLog(
        workoutLogId: String,
        exerciseName: String,
        exerciseId: String?,
        substitutedFromExerciseId: String?,
        substitutedFromName: String?,
        existingExerciseLogId: String?,
        set: SetLog,
    ): Result<SavedSetRef> = runCatching {
        val exerciseLogId = existingExerciseLogId ?: workoutDataSource.insertExerciseLog(
            ExerciseLogInsertDto(
                workoutLogId = workoutLogId,
                exerciseName = exerciseName,
                exerciseId = exerciseId,
                substitutedFromExerciseId = substitutedFromExerciseId,
                substitutedFromName = substitutedFromName,
            )
        ).id
        val inserted = workoutDataSource.insertSetLog(set.toInsertDto(exerciseLogId))
        SavedSetRef(exerciseLogId = exerciseLogId, setLogId = inserted.id)
    }

    override suspend fun updateSetLog(setLogId: String, set: SetLog): Result<Unit> = runCatching {
        workoutDataSource.updateSetLog(setLogId, set.toInsertDto(set.exerciseLogId))
    }

    override suspend fun deleteSetLog(setLogId: String): Result<Unit> = runCatching {
        workoutDataSource.deleteSetLog(setLogId)
    }

    override suspend fun finishWorkoutSession(
        workoutLogId: String,
        durationMinutes: Int,
        notes: String?,
    ): Result<Unit> = runCatching {
        workoutDataSource.updateWorkoutLog(
            workoutLogId,
            WorkoutLogUpdateDto(
                durationMinutes = durationMinutes,
                notes = notes,
                status = "completed",
            ),
        )
    }

    override suspend fun discardWorkoutSession(userId: String, workoutLogId: String): Result<Unit> = runCatching {
        workoutDataSource.updateWorkoutLog(workoutLogId, WorkoutLogUpdateDto(status = "discarded"))
        workoutDataSource.discardInProgressWorkoutLogs(userId)
    }

    override suspend fun getInProgressSession(userId: String): Result<WorkoutLog?> = runCatching {
        workoutDataSource.getInProgressWorkoutLog(userId)?.toDomain()
    }
}

internal fun shadowForks(workouts: List<Workout>): List<Workout> {
    val forkedIds = workouts.mapNotNull { it.forkedFromWorkoutId }.toSet()
    return workouts.filter { it.id !in forkedIds }
}

private fun SetLog.toInsertDto(exerciseLogId: String): SetLogInsertDto = SetLogInsertDto(
    exerciseLogId = exerciseLogId,
    sortOrder = sortOrder,
    targetReps = targetReps,
    actualReps = actualReps,
    targetWeightKg = targetWeightKg,
    actualWeightKg = actualWeightKg,
    rpe = rpe,
    targetRestSeconds = targetRestSeconds,
    actualRestSeconds = actualRestSeconds,
    completed = completed,
    actualDurationSeconds = actualDurationSeconds,
)

private fun ExerciseLogType.toDatabaseValue(): String = when (this) {
    ExerciseLogType.WEIGHT_REPS -> "weight_reps"
    ExerciseLogType.BODYWEIGHT_REPS -> "bodyweight_reps"
    ExerciseLogType.TIME -> "time"
}
