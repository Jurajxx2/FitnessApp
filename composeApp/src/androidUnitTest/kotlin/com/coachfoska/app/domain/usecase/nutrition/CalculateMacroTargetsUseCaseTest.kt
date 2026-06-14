package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.usecase.auth.aUser
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.math.roundToInt

class CalculateMacroTargetsUseCaseTest {

    private val useCase = CalculateMacroTargetsUseCase()

    // aUser(): 30y, 175 cm, 75 kg, MUSCLE_GAIN, MODERATELY_ACTIVE
    // BMR  = 10*75 + 6.25*175 - 5*30 + 5 = 1698.75
    // TDEE = 1698.75 * 1.55 = 2633.06
    // MUSCLE_GAIN +10% => 2896.37 -> 2896 kcal
    // protein = 75 * 1.8 = 135 g
    // fat = 2896.37 * 0.25 / 9 = 80.45 -> 80 g
    // carbs = (2896.37 - 135*4 - 80.45*9) / 4 = 408.06 -> 408 g
    @Test
    fun `computes targets for muscle gain`() {
        val targets = useCase(aUser())
        assertNotNull(targets)
        assertEquals(2896, targets.calories.roundToInt())
        assertEquals(135, targets.proteinG.roundToInt())
        assertEquals(80, targets.fatG.roundToInt())
        assertEquals(408, targets.carbsG.roundToInt())
    }

    @Test
    fun `weight loss reduces calories by 15 percent`() {
        val user = aUser().copy(goal = FitnessGoal.LOSE_WEIGHT)
        val targets = useCase(user)
        assertNotNull(targets)
        // 2633.06 * 0.85 = 2238.1
        assertEquals(2238, targets.calories.roundToInt())
    }

    @Test
    fun `mental strength keeps tdee unchanged`() {
        val user = aUser().copy(goal = FitnessGoal.STAY_FIT)
        val targets = useCase(user)
        assertNotNull(targets)
        assertEquals(2633, targets.calories.roundToInt())
    }

    @Test
    fun `sedentary uses 1_2 multiplier`() {
        val user = aUser().copy(goal = FitnessGoal.STAY_FIT, activityLevel = ActivityLevel.SEDENTARY)
        val targets = useCase(user)
        assertNotNull(targets)
        // 1698.75 * 1.2 = 2038.5
        assertEquals(2039, targets.calories.roundToInt())
    }

    @Test
    fun `returns null when body stats missing`() {
        assertNull(useCase(aUser().copy(weightKg = null)))
        assertNull(useCase(aUser().copy(heightCm = null)))
        assertNull(useCase(aUser().copy(age = null)))
        assertNull(useCase(aUser().copy(activityLevel = null)))
    }
}
