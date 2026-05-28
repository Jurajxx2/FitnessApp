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
            TimePeriod.ALL -> 365 * 3
        }
        val since = LocalDate.fromEpochDays(today.toEpochDays() - daysBack)
        return workoutRepository.getWorkoutCountByWeek(userId, since)
    }
}
