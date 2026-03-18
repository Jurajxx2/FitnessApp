package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.WeightEntry
import kotlinx.datetime.LocalDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WeightEntryInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("weight_kg") val weightKg: Float,
    @SerialName("recorded_at") val recordedAt: String,
    val notes: String? = null
)

@Serializable
data class WeightEntryDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("weight_kg") val weightKg: Float,
    @SerialName("recorded_at") val recordedAt: String,
    val notes: String? = null
) {
    fun toDomain(): WeightEntry = WeightEntry(
        id = id,
        userId = userId,
        weightKg = weightKg,
        recordedAt = LocalDate.parse(recordedAt),
        notes = notes
    )
}
