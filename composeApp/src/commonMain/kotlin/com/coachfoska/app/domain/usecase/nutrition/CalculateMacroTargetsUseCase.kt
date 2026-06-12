package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal

/**
 * Daily calorie / macro targets from profile data.
 * BMR via Mifflin–St Jeor; the profile has no sex field yet, so the male
 * constant (+5) is used for everyone until onboarding collects it.
 * Split: protein 1.8 g/kg bodyweight, fat 25% of calories, carbs the
 * remainder (4/9/4 kcal per gram).
 */
class CalculateMacroTargetsUseCase {

    operator fun invoke(user: User): MacroTargets? {
        val weight = user.weightKg ?: return null
        val height = user.heightCm ?: return null
        val age = user.age ?: return null
        val activity = user.activityLevel ?: return null

        val bmr = 10f * weight + 6.25f * height - 5f * age + 5f
        val tdee = bmr * activity.tdeeMultiplier()
        val calories = tdee * user.goal.calorieAdjustment()

        val proteinG = weight * 1.8f
        val fatG = calories * 0.25f / 9f
        val carbsG = ((calories - proteinG * 4f - fatG * 9f) / 4f).coerceAtLeast(0f)

        return MacroTargets(calories = calories, proteinG = proteinG, carbsG = carbsG, fatG = fatG)
    }

    private fun ActivityLevel.tdeeMultiplier(): Float = when (this) {
        ActivityLevel.SEDENTARY -> 1.2f
        ActivityLevel.LIGHTLY_ACTIVE -> 1.375f
        ActivityLevel.MODERATELY_ACTIVE -> 1.55f
        ActivityLevel.ACTIVE -> 1.725f
        ActivityLevel.VERY_ACTIVE -> 1.9f
    }

    private fun UserGoal?.calorieAdjustment(): Float = when (this) {
        UserGoal.WEIGHT_LOSS -> 0.85f
        UserGoal.MUSCLE_GAIN -> 1.10f
        UserGoal.MENTAL_STRENGTH, null -> 1.0f
    }
}
