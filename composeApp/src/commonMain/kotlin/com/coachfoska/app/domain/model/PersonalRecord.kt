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
    val longestDuration: RecordEntry? = null,
)

data class RecordEntry(
    val value: RecordValue,
    val detail: RecordDetail,
    val date: LocalDate,
)

// The headline metric of a record. Formatting (units, locale) happens in the UI layer,
// which is the only place with access to Compose string resources.
sealed interface RecordValue {
    data class Weight(val kg: Float) : RecordValue
    data class Reps(val count: Int) : RecordValue
    data class Duration(val seconds: Int) : RecordValue
}

// The subtitle describing how a record was achieved. Kept as structured data so the
// UI can localize it; the data layer stays free of presentation strings.
sealed interface RecordDetail {
    data class Sets(val count: Int) : RecordDetail
    data object LongestTimedSet : RecordDetail
    data class WeightAndReps(val weightKg: Float, val reps: Int) : RecordDetail
    data class RepsOnly(val reps: Int) : RecordDetail
    data class OneRmSource(val weightKg: Float, val reps: Int) : RecordDetail
}

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
