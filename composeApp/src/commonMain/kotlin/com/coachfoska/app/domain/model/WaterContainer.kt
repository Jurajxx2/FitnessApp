package com.coachfoska.app.domain.model

data class WaterContainer(
    val id: String,
    val name: String,
    val volumeMl: Int,
    val iconName: String = "bottle",
    val isFavorite: Boolean = false,
)
