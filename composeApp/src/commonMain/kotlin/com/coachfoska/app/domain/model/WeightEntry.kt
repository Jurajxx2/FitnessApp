package com.coachfoska.app.domain.model

import kotlinx.datetime.LocalDate

data class WeightEntry(
    val id: String,
    val userId: String,
    val weightKg: Float,
    val recordedAt: LocalDate,
    val notes: String? = null
)
