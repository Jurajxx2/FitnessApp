package com.coachfoska.app.ui.workout

enum class AnimatedImageMode { ANIMATED, STATIC, NONE }

fun animatedImageMode(startUrl: String?, endUrl: String?): AnimatedImageMode =
    when {
        startUrl != null && endUrl != null -> AnimatedImageMode.ANIMATED
        startUrl != null || endUrl != null -> AnimatedImageMode.STATIC
        else -> AnimatedImageMode.NONE
    }
