package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.DayCompletion
import com.coachfoska.app.domain.model.MuscleVolumeEntry
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount

data class ProgressDashboardState(
    val weeklyCompletions: List<DayCompletion> = emptyList(),
    val totalVolumeThisWeek: Float = 0f,
    val currentStreak: Int = 0,
    val muscleDistribution: List<MuscleVolumeEntry> = emptyList(),
    val recentPRs: List<PersonalRecord> = emptyList(),
    val workoutsPerWeek: List<WeeklyCount> = emptyList(),
    val selectedTimePeriod: TimePeriod = TimePeriod.THREE_MONTHS,
    val isLoading: Boolean = false,
    val error: String? = null,
)
