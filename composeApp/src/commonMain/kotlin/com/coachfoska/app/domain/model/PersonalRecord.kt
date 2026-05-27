package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate

enum class PRType {
    HEAVIEST_WEIGHT,
    MOST_REPS_AT_WEIGHT,
    BEST_ESTIMATED_1RM,
    HIGHEST_SESSION_VOLUME,
}

data class PersonalRecord(
    val type: PRType,
    val exerciseName: String,
    val value: String,
    val previousBest: String?,
    val achievedAt: Instant,
)

data class ExerciseRecords(
    val heaviestWeight: RecordEntry?,
    val mostRepsAtWeight: RecordEntry?,
    val highestEstimated1RM: RecordEntry?,
    val highestVolume: RecordEntry?,
)

data class RecordEntry(
    val value: String,
    val detail: String,
    val date: LocalDate,
)

data class MuscleVolumeEntry(
    val muscleGroup: String,
    val volumeKg: Float,
    val percentage: Float,
)

data class WeeklyCount(
    val weekStart: LocalDate,
    val count: Int,
)

data class SessionPR(
    val exerciseName: String,
    val record: String,
)
