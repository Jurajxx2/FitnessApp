package com.coachfoska.designsystem.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

@Composable
actual fun rememberPlatformReduceMotion(): Boolean =
    remember { UIAccessibilityIsReduceMotionEnabled() }
