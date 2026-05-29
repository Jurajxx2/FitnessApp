package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayCompletion
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.MuscleVolumeEntry
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.core.util.currentInstant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

class GetProgressDashboardUseCase(
    private val workoutRepository: WorkoutRepository
) {
    data class DashboardData(
        val weeklyCompletions: List<DayCompletion>,
        val totalVolumeThisWeek: Float,
        val currentStreak: Int,
        val muscleDistribution: List<MuscleVolumeEntry>,
        val recentPRs: List<PersonalRecord>,
    )

    suspend operator fun invoke(userId: String): Result<DashboardData> = runCatching {
        val history = workoutRepository.getWorkoutHistory(userId).getOrThrow()
        val streak = workoutRepository.getCurrentStreak(userId).getOrDefault(0)
        val recentPRs = workoutRepository.getRecentPersonalRecords(userId, 5).getOrDefault(emptyList())

        val tz = TimeZone.currentSystemDefault()
        val today = currentInstant().toLocalDateTime(tz).date
        val todayDow = today.dayOfWeek.ordinal // Monday=0

        val thisWeekStart = LocalDate.fromEpochDays(today.toEpochDays() - todayDow)
        val thisWeekLogs = history.filter { log ->
            val logDate = log.loggedAt.toLocalDateTime(tz).date
            logDate.toEpochDays() >= thisWeekStart.toEpochDays() &&
                logDate.toEpochDays() <= today.toEpochDays()
        }
        val completedDays = thisWeekLogs.map { it.loggedAt.toLocalDateTime(tz).date.dayOfWeek.ordinal }.toSet()

        val weeklyCompletions = DayOfWeek.entries.map { day ->
            val status = when {
                day.index in completedDays -> CompletionStatus.COMPLETED
                day.index == todayDow -> CompletionStatus.TODAY
                day.index < todayDow -> CompletionStatus.MISSED
                else -> CompletionStatus.UPCOMING
            }
            DayCompletion(dayOfWeek = day, status = status)
        }

        val totalVolume = thisWeekLogs.sumOf { log ->
            log.exerciseLogs.sumOf { ex ->
                ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }
            }
        }.toFloat()

        val workouts = workoutRepository.getAssignedWorkouts(userId).getOrDefault(emptyList())
        val muscleGroupByExerciseName = workouts.flatMap { it.exercises }
            .associate { it.name to (it.muscleGroup ?: "Other") }

        val volumeByMuscle = mutableMapOf<String, Float>()
        for (log in thisWeekLogs) {
            for (ex in log.exerciseLogs) {
                val muscle = muscleGroupByExerciseName[ex.exerciseName] ?: "Other"
                val vol = ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }.toFloat()
                volumeByMuscle[muscle] = (volumeByMuscle[muscle] ?: 0f) + vol
            }
        }
        val totalMuscleVolume = volumeByMuscle.values.sum().coerceAtLeast(1f)
        val muscleDistribution = volumeByMuscle.map { (group, vol) ->
            MuscleVolumeEntry(group, vol, vol / totalMuscleVolume * 100f)
        }.sortedByDescending { it.percentage }

        DashboardData(
            weeklyCompletions = weeklyCompletions,
            totalVolumeThisWeek = totalVolume,
            currentStreak = streak,
            muscleDistribution = muscleDistribution,
            recentPRs = recentPRs,
        )
    }
}
