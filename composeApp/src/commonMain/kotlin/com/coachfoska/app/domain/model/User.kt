package com.coachfoska.app.domain.model

data class User(
    val id: String,
    val email: String,
    val fullName: String?,
    val age: Int?,
    val heightCm: Float?,
    val weightKg: Float?,
    val goal: FitnessGoal?,
    val activityLevel: ActivityLevel?,
    val onboardingComplete: Boolean = false,
    val isBlocked: Boolean = false,
    val accessMode: AccessMode = AccessMode.BOTH,
)

enum class AccessMode {
    NUTRITION,
    ACTIVITY,
    BOTH;

    val canAccessNutrition: Boolean get() = this != ACTIVITY
    val canAccessActivity: Boolean get() = this != NUTRITION

    companion object {
        fun fromString(value: String?): AccessMode =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: BOTH
    }
}

enum class ActivityLevel(val displayName: String, val description: String) {
    SEDENTARY("Sedentary", "Little or no exercise"),
    LIGHTLY_ACTIVE("Lightly Active", "Light exercise 1–3 days/week"),
    MODERATELY_ACTIVE("Moderately Active", "Moderate exercise 3–5 days/week"),
    ACTIVE("Active", "Hard exercise 6–7 days/week"),
    VERY_ACTIVE("Very Active", "Very hard exercise & physical job");

    companion object {
        fun fromString(value: String?): ActivityLevel? =
            entries.firstOrNull { it.name.lowercase() == value?.lowercase() }
    }
}
