package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.OnboardingData
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OnboardingResponseDto(
    @SerialName("user_id") val userId: String,
    val gender: String? = null,
    val goal: String? = null,
    @SerialName("experience_level") val experienceLevel: String? = null,
    @SerialName("focus_areas") val focusAreas: List<String> = emptyList(),
    @SerialName("training_days") val trainingDays: List<String> = emptyList(),
    @SerialName("notifications_enabled") val notificationsEnabled: Boolean = false,
    // Derived from trainingDays.size; persisted for DB-side filtering convenience.
    @SerialName("frequency_per_week") val frequencyPerWeek: Int? = null,
    val equipment: String? = null,
    val age: Int? = null,
    @SerialName("height_cm") val heightCm: Float? = null,
    @SerialName("weight_kg") val weightKg: Float? = null,
    @SerialName("use_metric") val useMetric: Boolean = true,
    @SerialName("training_preference") val trainingPreference: String? = null,
    val name: String? = null,
    val bmi: Float? = null
) {
    companion object {
        fun fromDomain(userId: String, data: OnboardingData): OnboardingResponseDto =
            OnboardingResponseDto(
                userId = userId,
                gender = data.gender?.name?.lowercase(),
                goal = data.goal?.name?.lowercase(),
                experienceLevel = data.experienceLevel?.name?.lowercase(),
                focusAreas = data.focusAreas.map { it.name.lowercase() },
                trainingDays = data.trainingDays.map { it.name.lowercase() },
                notificationsEnabled = data.notificationsEnabled,
                frequencyPerWeek = data.frequencyPerWeek,
                equipment = data.equipment?.name?.lowercase(),
                age = data.age,
                heightCm = data.heightCm.toFloat(),
                weightKg = data.weightKg,
                useMetric = data.useMetric,
                trainingPreference = data.trainingPreference?.name?.lowercase(),
                name = data.name.ifBlank { null },
                bmi = data.bmi
            )
    }
}
