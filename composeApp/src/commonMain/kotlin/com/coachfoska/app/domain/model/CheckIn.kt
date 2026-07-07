package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate

data class CheckIn(
    val id: String,
    val userId: String,
    val weekOf: LocalDate,
    val weightKg: Float? = null,
    val energyLevel: Int? = null,        // 1..5
    val sleepQuality: Int? = null,       // 1..5
    val stressLevel: Int? = null,        // 1..5
    val trainingAdherence: Int? = null,  // sessions completed
    val nutritionAdherence: Int? = null, // 1..5
    val notes: String? = null,
    val photoFrontPath: String? = null,
    val photoSidePath: String? = null,
    val coachResponse: String? = null,
    val coachResponseAt: Instant? = null,
    val createdAt: Instant? = null,
)
