package com.coachfoska.app.domain.usecase.workout

class CalculateEstimated1RMUseCase {
    operator fun invoke(weightKg: Float, reps: Int): Float? {
        if (weightKg <= 0f || reps !in 1..30) return null
        if (reps == 1) return weightKg
        return weightKg * (1f + reps / 30f)
    }
}
