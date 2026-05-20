package com.coachfoska.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AppConfigDto(
    @SerialName("key") val key: String,
    @SerialName("value") val value: String
)
