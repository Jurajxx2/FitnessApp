package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

enum class OnboardingStep { GOAL, BODY_STATS, ACTIVITY_LEVEL, COMPLETE }

@Composable
fun OnboardingRoute(
    userId: String,
    onComplete: () -> Unit,
    viewModel: OnboardingViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.onboardingComplete) {
        if (state.onboardingComplete) {
            viewModel.onIntent(OnboardingIntent.NavigatedToHome)
            onComplete()
        }
    }

    OnboardingFlow(state = state, onIntent = viewModel::onIntent)
}

@Composable
fun OnboardingFlow(
    state: OnboardingState,
    onIntent: (OnboardingIntent) -> Unit
) {
    var step by remember { mutableStateOf(OnboardingStep.GOAL) }

    when (step) {
        OnboardingStep.GOAL -> GoalSelectionScreen(
            state = state,
            onIntent = onIntent,
            onBackClick = {},
            onNextClick = { step = OnboardingStep.BODY_STATS }
        )
        OnboardingStep.BODY_STATS -> BodyStatsScreen(
            state = state,
            onIntent = onIntent,
            onBackClick = { step = OnboardingStep.GOAL },
            onNextClick = { step = OnboardingStep.ACTIVITY_LEVEL }
        )
        OnboardingStep.ACTIVITY_LEVEL -> ActivityLevelScreen(
            state = state,
            onIntent = onIntent,
            onBackClick = { step = OnboardingStep.BODY_STATS },
            onNextClick = { step = OnboardingStep.COMPLETE }
        )
        OnboardingStep.COMPLETE -> OnboardingCompleteScreen(
            state = state,
            onIntent = onIntent
        )
    }
}
