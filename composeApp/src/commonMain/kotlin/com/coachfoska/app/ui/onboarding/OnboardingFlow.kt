package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel

enum class OnboardingStep {
    GOAL, BODY_STATS, ACTIVITY_LEVEL, COMPLETE
}

/**
 * Single composable that hosts the entire onboarding flow internally.
 * Uses a single OnboardingViewModel so state is shared across all steps.
 */
@Composable
fun OnboardingFlow(
    viewModel: OnboardingViewModel,
    onComplete: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var step by remember { mutableStateOf(OnboardingStep.GOAL) }

    LaunchedEffect(state.onboardingComplete) {
        if (state.onboardingComplete) {
            viewModel.onIntent(OnboardingIntent.NavigatedToHome)
            onComplete()
        }
    }

    when (step) {
        OnboardingStep.GOAL -> GoalSelectionScreen(
            onboardingViewModel = viewModel,
            onBackClick = { /* First step, no back */ },
            onNextClick = { step = OnboardingStep.BODY_STATS }
        )
        OnboardingStep.BODY_STATS -> BodyStatsScreen(
            onboardingViewModel = viewModel,
            onBackClick = { step = OnboardingStep.GOAL },
            onNextClick = { step = OnboardingStep.ACTIVITY_LEVEL }
        )
        OnboardingStep.ACTIVITY_LEVEL -> ActivityLevelScreen(
            onboardingViewModel = viewModel,
            onBackClick = { step = OnboardingStep.BODY_STATS },
            onNextClick = { step = OnboardingStep.COMPLETE }
        )
        OnboardingStep.COMPLETE -> OnboardingCompleteScreen(
            onboardingViewModel = viewModel,
            onStartClick = { /* handled via LaunchedEffect above */ }
        )
    }
}
