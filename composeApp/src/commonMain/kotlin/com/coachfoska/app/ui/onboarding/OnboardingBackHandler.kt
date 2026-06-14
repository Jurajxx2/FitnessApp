package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.Composable

/** Platform-specific back-press handler for the onboarding flow.
 *  Android: delegates to androidx.activity.compose.BackHandler.
 *  iOS: no-op (iOS back is handled via swipe gesture / navigation bar). */
@Composable
expect fun OnboardingBackHandler(enabled: Boolean = true, onBack: () -> Unit)
