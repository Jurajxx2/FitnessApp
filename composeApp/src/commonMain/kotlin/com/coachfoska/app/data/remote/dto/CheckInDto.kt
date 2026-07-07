package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.CheckIn
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CheckInDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("week_of") val weekOf: String,
    @SerialName("weight_kg") val weightKg: Float? = null,
    @SerialName("energy_level") val energyLevel: Int? = null,
    @SerialName("sleep_quality") val sleepQuality: Int? = null,
    @SerialName("stress_level") val stressLevel: Int? = null,
    @SerialName("training_adherence") val trainingAdherence: Int? = null,
    @SerialName("nutrition_adherence") val nutritionAdherence: Int? = null,
    val notes: String? = null,
    @SerialName("photo_front_path") val photoFrontPath: String? = null,
    @SerialName("photo_side_path") val photoSidePath: String? = null,
    @SerialName("coach_response") val coachResponse: String? = null,
    @SerialName("coach_response_at") val coachResponseAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
) {
    fun toDomain(): CheckIn = CheckIn(
        id = id,
        userId = userId,
        weekOf = LocalDate.parse(weekOf),
        weightKg = weightKg,
        energyLevel = energyLevel,
        sleepQuality = sleepQuality,
        stressLevel = stressLevel,
        trainingAdherence = trainingAdherence,
        nutritionAdherence = nutritionAdherence,
        notes = notes,
        photoFrontPath = photoFrontPath,
        photoSidePath = photoSidePath,
        coachResponse = coachResponse,
        coachResponseAt = coachResponseAt?.let { Instant.parse(it) },
        createdAt = createdAt?.let { Instant.parse(it) },
    )
}

/**
 * Payload for insert/upsert on (user_id, week_of). Coach fields are never written by the app.
 *
 * Deliberately has NO default values: supabase-kt's Json config omits default-valued properties
 * that still equal their default (encodeDefaults = false), so a cleared (null) field would be
 * dropped from the payload entirely and `ON CONFLICT DO UPDATE` would keep the stale column
 * value. Making every property mandatory forces kotlinx.serialization to always encode it,
 * serializing cleared fields as explicit JSON nulls that actually reach the update.
 */
@Serializable
data class CheckInUpsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("week_of") val weekOf: String,
    @SerialName("weight_kg") val weightKg: Float?,
    @SerialName("energy_level") val energyLevel: Int?,
    @SerialName("sleep_quality") val sleepQuality: Int?,
    @SerialName("stress_level") val stressLevel: Int?,
    @SerialName("training_adherence") val trainingAdherence: Int?,
    @SerialName("nutrition_adherence") val nutritionAdherence: Int?,
    val notes: String?,
    @SerialName("photo_front_path") val photoFrontPath: String?,
    @SerialName("photo_side_path") val photoSidePath: String?,
)
