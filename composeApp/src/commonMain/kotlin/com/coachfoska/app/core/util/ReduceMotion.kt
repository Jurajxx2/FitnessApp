package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf

/** True when the OS asks apps to minimise motion. Checked once per composition root. */
@Composable
expect fun rememberPlatformReduceMotion(): Boolean

val LocalReduceMotion = staticCompositionLocalOf { false }
