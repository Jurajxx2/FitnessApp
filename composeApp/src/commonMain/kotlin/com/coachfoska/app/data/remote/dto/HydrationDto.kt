package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import kotlinx.datetime.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WaterLogDto(
    @SerialName("id") val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("amount_ml") val amountMl: Int,
    @SerialName("logged_at") val loggedAt: Instant
) {
    fun toDomain(): WaterLog = WaterLog(
        id = id,
        amountMl = amountMl,
        loggedAt = loggedAt
    )
}

@Serializable
data class WaterLogInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("amount_ml") val amountMl: Int,
    @SerialName("logged_at") val loggedAt: String
)

@Serializable
data class HydrationSettingsDto(
    @SerialName("user_id") val userId: String,
    @SerialName("interval_minutes") val intervalMinutes: Int = 120,
    @SerialName("start_hour") val startHour: Int = 7,
    @SerialName("end_hour") val endHour: Int = 22,
    @SerialName("smart_suppress") val smartSuppress: Boolean = true,
    @SerialName("reminders_enabled") val remindersEnabled: Boolean = true
) {
    fun toDomain(): HydrationSettings = HydrationSettings(
        intervalMinutes = intervalMinutes,
        startHour = startHour,
        endHour = endHour,
        smartSuppress = smartSuppress,
        remindersEnabled = remindersEnabled
    )
}
