package com.coachfoska.app.core.util

import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

actual fun platformReduceMotionEnabled(): Boolean = UIAccessibilityIsReduceMotionEnabled()
