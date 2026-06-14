package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.Composable

@Composable
actual fun OnboardingBackHandler(enabled: Boolean, onBack: () -> Unit) {
    // No-op: iOS back navigation is handled via swipe gesture / navigation bar.
}
