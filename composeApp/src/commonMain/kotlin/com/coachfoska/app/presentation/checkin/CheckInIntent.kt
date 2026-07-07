package com.coachfoska.app.presentation.checkin

sealed interface CheckInIntent {
    data object Load : CheckInIntent
    data class WeightChanged(val value: String) : CheckInIntent
    data class EnergyChanged(val value: Int) : CheckInIntent
    data class SleepChanged(val value: Int) : CheckInIntent
    data class StressChanged(val value: Int) : CheckInIntent
    data class TrainingAdherenceChanged(val value: String) : CheckInIntent
    data class NutritionAdherenceChanged(val value: Int) : CheckInIntent
    data class NotesChanged(val value: String) : CheckInIntent
    data class PhotoPicked(val slot: String, val bytes: ByteArray) : CheckInIntent {
        override fun equals(other: Any?) = this === other
        override fun hashCode() = slot.hashCode()
    }
    data object Submit : CheckInIntent
    data object ClearError : CheckInIntent
}
