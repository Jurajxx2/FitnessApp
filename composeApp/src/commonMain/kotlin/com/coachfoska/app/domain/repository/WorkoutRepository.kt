package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.SavedSetRef
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutDraft
import com.coachfoska.app.domain.model.WorkoutLog
import kotlinx.datetime.LocalDate

interface WorkoutRepository {
    /** Returns workouts assigned to the user by the coach. */
    suspend fun getAssignedWorkouts(userId: String): Result<List<Workout>>

    /** Returns the full catalog of active workouts, regardless of assignment. */
    suspend fun getAllWorkouts(): Result<List<Workout>>

    /** Returns a single workout with its exercises. */
    suspend fun getWorkoutById(workoutId: String): Result<Workout>

    /** Logs a completed workout session. */
    suspend fun logWorkout(
        userId: String,
        workoutId: String?,
        workoutName: String,
        durationMinutes: Int,
        notes: String?,
        exerciseLogs: List<ExerciseLog>
    ): Result<WorkoutLog>

    /** Returns user's logged workout history. */
    suspend fun getWorkoutHistory(userId: String): Result<List<WorkoutLog>>

    /** Returns sets from the most recent session for each given exercise name, keyed by exercise name. */
    suspend fun getLastLogsForExercises(
        userId: String,
        exerciseNames: List<String>
    ): Result<Map<String, List<SetLog>>>

    /** Returns all logged sessions containing this exercise, ordered by date descending. */
    suspend fun getExerciseHistory(
        userId: String,
        exerciseName: String
    ): Result<List<ExerciseLog>>

    /** Returns all-time personal records for a specific exercise. */
    suspend fun getExerciseRecords(
        userId: String,
        exerciseName: String
    ): Result<ExerciseRecords>

    /** Returns recent PRs across all exercises. */
    suspend fun getRecentPersonalRecords(
        userId: String,
        limit: Int = 5
    ): Result<List<PersonalRecord>>

    /** Returns workout count grouped by ISO week since a given date. */
    suspend fun getWorkoutCountByWeek(
        userId: String,
        since: LocalDate
    ): Result<List<WeeklyCount>>

    /** Returns the number of consecutive weeks (ending with current) with at least 1 workout. */
    suspend fun getCurrentStreak(userId: String): Result<Int>

    /** Creates a new user-authored workout plan. */
    suspend fun createUserWorkout(
        userId: String,
        draft: WorkoutDraft,
        forkedFromWorkoutId: String? = null,
    ): Result<Workout>

    /** Updates the name/day/notes and replaces all exercises of a user-authored workout. */
    suspend fun updateUserWorkout(workoutId: String, draft: WorkoutDraft): Result<Workout>

    /** Deletes a user-authored workout plan. */
    suspend fun deleteUserWorkout(workoutId: String): Result<Unit>

    /** Starts a live session and returns the workout_log id. */
    suspend fun startWorkoutSession(
        userId: String,
        workoutId: String?,
        workoutName: String,
    ): Result<String>

    /** Inserts a set log, creating the parent exercise_log lazily when needed. */
    suspend fun saveSetLog(
        workoutLogId: String,
        exerciseName: String,
        exerciseId: String?,
        substitutedFromExerciseId: String?,
        substitutedFromName: String?,
        existingExerciseLogId: String?,
        set: SetLog,
    ): Result<SavedSetRef>

    /** Updates an existing set log row. */
    suspend fun updateSetLog(setLogId: String, set: SetLog): Result<Unit>

    /** Deletes an existing set log row. */
    suspend fun deleteSetLog(setLogId: String): Result<Unit>

    /** Marks the live session completed. */
    suspend fun finishWorkoutSession(
        workoutLogId: String,
        durationMinutes: Int,
        notes: String?,
    ): Result<Unit>

    /** Marks the live session discarded. */
    suspend fun discardWorkoutSession(workoutLogId: String): Result<Unit>

    /** Returns the newest in-progress session, including exercise/set rows when present. */
    suspend fun getInProgressSession(userId: String): Result<WorkoutLog?>
}
