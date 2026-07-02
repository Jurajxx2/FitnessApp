package com.coachfoska.app.core.util

// TODO wire animator-scale check: no Application singleton exists in this project;
// actuals that need a Context are @Composable and obtain it via LocalContext.current.
// platformReduceMotionEnabled() is a non-composable function, so Settings.Global
// cannot be read here without an app-level context holder. Add one when available.
actual fun platformReduceMotionEnabled(): Boolean = false
