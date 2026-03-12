package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    @SerialName("full_name") val fullName: String? = null,
    val age: Int? = null,
    @SerialName("height_cm") val heightCm: Float? = null,
    @SerialName("weight_kg") val weightKg: Float? = null,
    val goal: String? = null,
    @SerialName("activity_level") val activityLevel: String? = null,
    @SerialName("onboarding_complete") val onboardingComplete: Boolean = false
) {
    fun toDomain(): User = User(
        id = id,
        email = email,
        fullName = fullName,
        age = age,
        heightCm = heightCm,
        weightKg = weightKg,
        goal = UserGoal.fromString(goal),
        activityLevel = ActivityLevel.fromString(activityLevel),
        onboardingComplete = onboardingComplete
    )
}
