package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import kotlinx.datetime.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class GeneralActivityLogDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("activity_type") val activityType: String,
    @SerialName("duration_minutes") val durationMinutes: Int,
    @SerialName("distance_km") val distanceKm: Double? = null,
    val rpe: Int? = null,
    @SerialName("logged_at") val loggedAt: String,
    val notes: String? = null,
) {
    fun toDomain(): GeneralActivityLog = GeneralActivityLog(
        id = id,
        userId = userId,
        type = ActivityType.fromStorageValue(activityType),
        durationMinutes = durationMinutes,
        distanceKm = distanceKm,
        rpe = rpe,
        loggedAt = Instant.parse(loggedAt),
        notes = notes,
    )
}

@Serializable
data class GeneralActivityLogInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("activity_type") val activityType: String,
    @SerialName("duration_minutes") val durationMinutes: Int,
    @SerialName("distance_km") val distanceKm: Double? = null,
    val rpe: Int? = null,
    @SerialName("logged_at") val loggedAt: String,
    val notes: String? = null,
)
