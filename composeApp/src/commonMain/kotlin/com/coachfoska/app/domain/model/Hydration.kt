package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant

data class WaterLog(
    val id: String,
    val amountMl: Int,
    val loggedAt: Instant
)

data class HydrationSettings(
    val intervalMinutes: Int = 120,
    val startHour: Int = 7,
    val endHour: Int = 22,
    val smartSuppress: Boolean = true,
    val remindersEnabled: Boolean = true
)
