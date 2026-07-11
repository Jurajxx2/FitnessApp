package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayActivityStatus
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
        val completedWorkoutsThisWeek: Int,
        val plannedWorkoutsThisWeek: Int,
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
        val workouts = workoutRepository.getAssignedWorkouts(userId).getOrDefault(emptyList())
        val weeklyActivity = buildWeeklyActivity(workouts, history, today, tz)
        val planCompliance = deriveWeeklyCompliance(weeklyActivity)
        val completedUnplanned = weeklyActivity.count { it.status == DayActivityStatus.COMPLETED }
        val completedWorkouts = if (planCompliance.assigned > 0) {
            planCompliance.completed
        } else {
            completedUnplanned
        }
        val plannedWorkouts = if (planCompliance.assigned > 0) {
            planCompliance.assigned
        } else {
            completedUnplanned
        }

        // Only scheduled days can be missed. The previous implementation marked every earlier
        // rest day as missed, producing an incorrect 0/7-style compliance statistic.
        val weeklyCompletions = weeklyActivity.map { activity ->
            val status = when (activity.status) {
                DayActivityStatus.COMPLETED -> CompletionStatus.COMPLETED
                DayActivityStatus.TODAY -> CompletionStatus.TODAY
                DayActivityStatus.MISSED -> CompletionStatus.MISSED
                DayActivityStatus.SCHEDULED,
                DayActivityStatus.REST -> CompletionStatus.UPCOMING
            }
            DayCompletion(dayOfWeek = activity.dayOfWeek, status = status)
        }

        val totalVolume = thisWeekLogs.sumOf { log ->
            log.exerciseLogs.sumOf { ex ->
                ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }
            }
        }.toFloat()

        val plannedExercises = workouts.flatMap { it.exercises }
        val muscleGroupByExerciseId = plannedExercises
            .mapNotNull { exercise -> exercise.exerciseId?.let { it to (exercise.muscleGroup ?: "Other") } }
            .toMap()
        val muscleGroupByExerciseName = plannedExercises
            .associate { it.name to (it.muscleGroup ?: "Other") }

        val volumeByMuscle = mutableMapOf<String, Float>()
        for (log in thisWeekLogs) {
            for (ex in log.exerciseLogs) {
                val muscle = muscleGroupByExerciseId[ex.exerciseId]
                    ?: muscleGroupByExerciseName[ex.exerciseName]
                    ?: "Other"
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
            completedWorkoutsThisWeek = completedWorkouts,
            plannedWorkoutsThisWeek = plannedWorkouts,
            totalVolumeThisWeek = totalVolume,
            currentStreak = streak,
            muscleDistribution = muscleDistribution,
            recentPRs = recentPRs,
        )
    }
}
