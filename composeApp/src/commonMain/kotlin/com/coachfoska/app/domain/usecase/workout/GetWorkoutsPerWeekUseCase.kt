package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.core.util.currentInstant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

class GetWorkoutsPerWeekUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        period: TimePeriod
    ): Result<List<WeeklyCount>> {
        val tz = TimeZone.currentSystemDefault()
        val today = currentInstant().toLocalDateTime(tz).date
        val daysBack = when (period) {
            TimePeriod.ONE_MONTH -> 30
            TimePeriod.THREE_MONTHS -> 90
            TimePeriod.SIX_MONTHS -> 180
            TimePeriod.ONE_YEAR -> 365
            // "All" must not silently turn into a three-year window. The repository query is
            // indexed by logged_at, so using the Unix epoch remains a cheap, truthful lower bound.
            TimePeriod.ALL -> null
        }
        val since = daysBack?.let { LocalDate.fromEpochDays(today.toEpochDays() - it) }
            ?: LocalDate.fromEpochDays(0)
        return workoutRepository.getWorkoutCountByWeek(userId, since).map { reportedCounts ->
            if (reportedCounts.isEmpty()) return@map emptyList()

            val countsByWeek = reportedCounts.associateBy { it.weekStart }
            val currentWeek = weekStart(today)
            val firstWeek = when (period) {
                TimePeriod.ALL -> reportedCounts.minOf { it.weekStart }
                else -> weekStart(since)
            }

            buildList {
                var week = firstWeek
                while (week <= currentWeek) {
                    add(countsByWeek[week] ?: WeeklyCount(weekStart = week, count = 0))
                    week = LocalDate.fromEpochDays(week.toEpochDays() + 7)
                }
            }
        }
    }

    private fun weekStart(date: LocalDate): LocalDate =
        LocalDate.fromEpochDays(date.toEpochDays() - date.dayOfWeek.ordinal)
}
