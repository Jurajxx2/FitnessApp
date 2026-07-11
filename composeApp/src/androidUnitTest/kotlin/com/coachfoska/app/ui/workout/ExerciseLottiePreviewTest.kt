package com.coachfoska.app.ui.workout

import com.coachfoska.app.domain.model.ExerciseLottieAnimation
import com.coachfoska.app.domain.model.ExerciseLottieVariant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ExerciseLottiePreviewTest {

    @Test
    fun `database Lottie payload selection uses the requested figure with a safe fallback`() {
        val payloads = listOf(
            ExerciseLottieAnimation(
                variant = ExerciseLottieVariant.MAN,
                lottieJson = "{\"nm\":\"man\"}",
                storageUrl = "https://example.com/man.json",
            ),
            ExerciseLottieAnimation(
                variant = ExerciseLottieVariant.WOMAN,
                lottieJson = "{\"nm\":\"woman\"}",
                storageUrl = "https://example.com/woman.json",
            ),
        )

        assertEquals("{\"nm\":\"man\"}", payloads.lottieJsonFor(ExerciseFigureVariant.Man))
        assertEquals("{\"nm\":\"woman\"}", payloads.lottieJsonFor(ExerciseFigureVariant.Woman))
        assertEquals("{\"nm\":\"man\"}", payloads.lottieJsonFor(ExerciseFigureVariant.Neutral))
    }

    @Test
    fun `catalog emits valid 160px lottie payloads for all supported exercises and figure variants`() {
        val exercises = listOf(
            "Barbell Back Squat", "Push-Up", "Barbell Bench Press", "Barbell Deadlift", "Pull-Up",
            "Overhead Press", "Bent-Over Row", "Dumbbell Lunge", "Plank", "Crunch",
            "Dumbbell Bicep Curl", "Triceps Pushdown", "Dumbbell Lateral Raise", "Dumbbell Front Raise",
            "Leg Press", "Barbell Hip Thrust", "Romanian Deadlift", "Standing Calf Raise", "Leg Extension",
            "Leg Curl", "Lat Pulldown", "Cable Chest Fly", "Dip", "Burpee", "Mountain Climber",
            "Russian Twist", "Hanging Leg Raise", "Kettlebell Swing", "Goblet Squat", "Step-Up",
        )

        exercises.forEach { exercise ->
            ExerciseFigureVariant.entries.forEach { figureVariant ->
                val payload = assertNotNull(ExerciseLottieCatalog.jsonFor(exercise, figureVariant))
                val root = Json.parseToJsonElement(payload).jsonObject

                assertEquals(160, root.getValue("w").jsonPrimitive.content.toInt())
                assertEquals(160, root.getValue("h").jsonPrimitive.content.toInt())
                assertEquals(60, root.getValue("op").jsonPrimitive.content.toInt())
                assertTrue(root.getValue("layers").jsonArray.isNotEmpty())
            }
        }
    }
}
