package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User

class CalculateWaterGoalUseCase {
    operator fun invoke(user: User): Int {
        val weight = user.weightKg ?: return 2000
        val level = user.activityLevel ?: return 2000
        val multiplier = when (level) {
            ActivityLevel.SEDENTARY -> 1.0
            ActivityLevel.LIGHTLY_ACTIVE -> 1.1
            ActivityLevel.MODERATELY_ACTIVE -> 1.2
            ActivityLevel.ACTIVE -> 1.3
            ActivityLevel.VERY_ACTIVE -> 1.4
        }
        return (weight * 35 * multiplier).toInt()
    }
}
