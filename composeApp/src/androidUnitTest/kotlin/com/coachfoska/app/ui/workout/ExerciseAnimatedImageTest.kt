package com.coachfoska.app.ui.workout

import kotlin.test.Test
import kotlin.test.assertEquals

class ExerciseAnimatedImageTest {

    @Test
    fun bothUrlsPresent_isAnimated() {
        assertEquals(
            AnimatedImageMode.ANIMATED,
            animatedImageMode("start.jpg", "end.jpg")
        )
    }

    @Test
    fun onlyStartUrl_isStatic() {
        assertEquals(
            AnimatedImageMode.STATIC,
            animatedImageMode("start.jpg", null)
        )
    }

    @Test
    fun onlyEndUrl_isStatic() {
        assertEquals(
            AnimatedImageMode.STATIC,
            animatedImageMode(null, "end.jpg")
        )
    }

    @Test
    fun noUrls_isNone() {
        assertEquals(
            AnimatedImageMode.NONE,
            animatedImageMode(null, null)
        )
    }
}
