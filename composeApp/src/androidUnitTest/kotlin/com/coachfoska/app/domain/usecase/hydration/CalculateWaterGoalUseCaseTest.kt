package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import kotlin.test.Test
import kotlin.test.assertEquals

class CalculateWaterGoalUseCaseTest {

    private val useCase = CalculateWaterGoalUseCase()

    private fun user(weightKg: Float?, activityLevel: ActivityLevel?) = User(
        id = "u1", email = "a@b.com", fullName = null,
        age = null, heightCm = null,
        weightKg = weightKg, goal = UserGoal.MUSCLE_GAIN,
        activityLevel = activityLevel
    )

    @Test
    fun `sedentary 80kg returns 2800ml`() {
        assertEquals(2800, useCase(user(80f, ActivityLevel.SEDENTARY)))
    }

    @Test
    fun `active 70kg returns 3185ml`() {
        assertEquals(3185, useCase(user(70f, ActivityLevel.ACTIVE)))
    }

    @Test
    fun `very active 90kg returns 4410ml`() {
        assertEquals(4410, useCase(user(90f, ActivityLevel.VERY_ACTIVE)))
    }

    @Test
    fun `null weight falls back to 2000ml`() {
        assertEquals(2000, useCase(user(null, ActivityLevel.ACTIVE)))
    }

    @Test
    fun `null activity level falls back to 2000ml`() {
        assertEquals(2000, useCase(user(70f, null)))
    }
}
