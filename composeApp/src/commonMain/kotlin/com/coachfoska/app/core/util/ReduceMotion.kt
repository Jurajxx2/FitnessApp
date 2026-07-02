package com.coachfoska.app.core.util

import androidx.compose.runtime.staticCompositionLocalOf

/** True when the OS asks apps to minimise motion. Checked once per app launch. */
expect fun platformReduceMotionEnabled(): Boolean

val LocalReduceMotion = staticCompositionLocalOf { false }
