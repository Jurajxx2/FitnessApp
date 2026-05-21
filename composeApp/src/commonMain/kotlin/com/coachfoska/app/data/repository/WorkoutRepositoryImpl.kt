package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.SetLogInsertDto
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class WorkoutRepositoryImpl(
    private val workoutDataSource: WorkoutRemoteDataSource
) : WorkoutRepository {

    override suspend fun getAssignedWorkouts(userId: String): Result<List<Workout>> = runCatching {
        workoutDataSource.getAssignedWorkouts(userId).map { it.toDomain() }
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

        val setsByExerciseId = setLogs.groupBy { it.exerciseLogId }
        val exercisesByWorkoutId = exerciseLogs
            .map { it.copy(setLogs = setsByExerciseId[it.id].orEmpty().sortedBy { s -> s.sortOrder }) }
            .groupBy { it.workoutLogId }

        workoutLogs.map { wl ->
            wl.copy(exerciseLogs = exercisesByWorkoutId[wl.id].orEmpty()).toDomain()
        }
    }
}
