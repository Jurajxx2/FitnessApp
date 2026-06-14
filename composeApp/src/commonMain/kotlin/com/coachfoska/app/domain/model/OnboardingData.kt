package com.coachfoska.app.domain.model

enum class Gender { MALE, FEMALE }

/** Canonical fitness goal used app-wide (replaces the legacy UserGoal). */
enum class FitnessGoal(val displayName: String) {
    BUILD_MUSCLE("Build Muscle"),
    LOSE_WEIGHT("Lose Weight"),
    STAY_FIT("Stay Fit"),
    GET_STRONGER("Get Stronger");

    companion object {
        fun fromString(value: String?): FitnessGoal? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}

enum class ExperienceLevel(val bars: Int) {
    BEGINNER(1),
    INTERMEDIATE(2),
    ADVANCED(3),
    EXPERT(4);

    companion object {
        fun fromString(value: String?): ExperienceLevel? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}

enum class MuscleGroup {
    CHEST, BACK, SHOULDERS, ARMS, ABS, LEGS, GLUTES, FULL_BODY;

    companion object {
        /** All real muscle groups (everything except the FULL_BODY aggregate). */
        val individual: List<MuscleGroup> get() = entries.filter { it != FULL_BODY }

        fun fromString(value: String?): MuscleGroup? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}

enum class Equipment {
    NO_EQUIPMENT, DUMBBELLS, HOME_GYM, FULL_GYM;

    companion object {
        fun fromString(value: String?): Equipment? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}

enum class TrainingPreference {
    WITH_COACH, SELF_GUIDED, BOTH;

    companion object {
        fun fromString(value: String?): TrainingPreference? =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
    }
}

enum class BmiCategory { UNDERWEIGHT, NORMAL, OVERWEIGHT, OBESE, EXTREMELY_OBESE }

data class OnboardingData(
    val gender: Gender? = null,
    val goal: FitnessGoal? = null,
    val experienceLevel: ExperienceLevel? = null,
    val focusAreas: Set<MuscleGroup> = emptySet(),
    val frequencyPerWeek: Int = 3,
    val equipment: Equipment? = null,
    val age: Int = 30,
    val heightCm: Int = 175,
    val weightKg: Float = 75f,
    val useMetric: Boolean = true,
    val trainingPreference: TrainingPreference? = null,
    val name: String = ""
) {
    val bmi: Float
        get() {
            val heightM = heightCm / 100f
            return if (heightM > 0f) weightKg / (heightM * heightM) else 0f
        }

    val bmiCategory: BmiCategory
        get() = when {
            bmi < 18.5f -> BmiCategory.UNDERWEIGHT
            bmi < 25f -> BmiCategory.NORMAL
            bmi < 30f -> BmiCategory.OVERWEIGHT
            bmi < 35f -> BmiCategory.OBESE
            else -> BmiCategory.EXTREMELY_OBESE
        }
}
