package com.coachfoska.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DeviceTokenInsertDto(
    @SerialName("user_id") val userId: String,
    val platform: String,
    val token: String
)
