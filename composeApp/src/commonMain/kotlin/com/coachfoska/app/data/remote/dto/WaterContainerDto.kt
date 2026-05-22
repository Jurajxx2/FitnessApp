package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.WaterContainer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class WaterContainerDto(
    val id: String,
    @SerialName("user_id")     val userId: String,
    val name: String,
    @SerialName("volume_ml")   val volumeMl: Int,
    @SerialName("icon_name")   val iconName: String = "bottle",
    @SerialName("is_favorite") val isFavorite: Boolean = false,
) {
    fun toDomain(): WaterContainer = WaterContainer(
        id = id, name = name, volumeMl = volumeMl,
        iconName = iconName, isFavorite = isFavorite,
    )
}

@Serializable
data class WaterContainerInsertDto(
    @SerialName("user_id")     val userId: String,
    val name: String,
    @SerialName("volume_ml")   val volumeMl: Int,
    @SerialName("icon_name")   val iconName: String = "bottle",
    @SerialName("is_favorite") val isFavorite: Boolean = false,
)

@Serializable
data class WaterContainerFavoriteUpdateDto(
    @SerialName("is_favorite") val isFavorite: Boolean,
)
