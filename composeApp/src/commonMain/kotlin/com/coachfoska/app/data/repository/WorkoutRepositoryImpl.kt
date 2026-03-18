package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
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
        exerciseLogs: List<ExerciseLog>
    ): Result<WorkoutLog> = runCatching {
        val logDto = workoutDataSource.insertWorkoutLog(
            userId, workoutId, workoutName, durationMinutes, notes
        )
        val exercisePayloads = exerciseLogs.map { log ->
            ExerciseLogInsertDto(
                workoutLogId = logDto.id,
                exerciseName = log.exerciseName,
                setsCompleted = log.setsCompleted,
                repsCompleted = log.repsCompleted,
                weightKg = log.weightKg,
                notes = log.notes
            )
        }
        val insertedLogs = if (exercisePayloads.isNotEmpty()) {
            workoutDataSource.insertExerciseLogs(exercisePayloads)
        } else emptyList()

        logDto.copy(exerciseLogs = insertedLogs).toDomain()
    }

    override suspend fun getWorkoutHistory(userId: String): Result<List<WorkoutLog>> = runCatching {
        workoutDataSource.getWorkoutHistory(userId).map { it.toDomain() }
    }
}
