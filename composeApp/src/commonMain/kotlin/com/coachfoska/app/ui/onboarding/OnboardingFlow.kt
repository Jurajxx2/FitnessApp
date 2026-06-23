package com.coachfoska.app.ui.onboarding

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingStep
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import com.coachfoska.app.ui.onboarding.components.OnboardingScaffold
import com.coachfoska.app.ui.onboarding.screens.*
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun OnboardingRoute(
    userId: String,
    onComplete: () -> Unit,
    viewModel: OnboardingViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    val pagerState = rememberPagerState(pageCount = { OnboardingStep.entries.size })
    LaunchedEffect(state.currentStep) {
        if (pagerState.currentPage != state.currentStep) pagerState.animateScrollToPage(state.currentStep)
    }

    OnboardingBackHandler(enabled = true) {
        if (state.currentStep > 0) viewModel.onIntent(OnboardingIntent.PreviousStep)
    }

    HorizontalPager(
        state = pagerState,
        userScrollEnabled = false,
        modifier = Modifier.fillMaxSize()
    ) { page ->
        val step = OnboardingStep.entries[page]
        OnboardingScaffold(
            showChrome = step.showChrome,
            progress = state.progress,
            onBack = { viewModel.onIntent(OnboardingIntent.PreviousStep) }
        ) { bodyModifier ->
            when (step) {
                OnboardingStep.GENDER -> GenderStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                OnboardingStep.GOAL -> GoalStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                OnboardingStep.EXPERIENCE -> ExperienceStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                OnboardingStep.FOCUS_AREAS -> FocusAreasStep(state, viewModel::onIntent, bodyModifier)
                OnboardingStep.VALUE_PROP_1 -> ValueProp1Step(onContinue = { viewModel.onIntent(OnboardingIntent.NextStep) }, modifier = bodyModifier)
                OnboardingStep.FREQUENCY -> FrequencyStep(state, viewModel::onIntent, bodyModifier)
                OnboardingStep.EQUIPMENT -> EquipmentStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                OnboardingStep.BODY_STATS -> BodyStatsStep(state, viewModel::onIntent, bodyModifier)
                OnboardingStep.VALUE_PROP_2 -> ValueProp2Step(onContinue = { viewModel.onIntent(OnboardingIntent.NextStep) }, modifier = bodyModifier)
                OnboardingStep.TRAINING_PREFERENCE -> TrainingPreferenceStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                OnboardingStep.NAME -> NameStep(state, viewModel::onIntent, onDone = { viewModel.onIntent(OnboardingIntent.NextStep) }, modifier = bodyModifier)
                OnboardingStep.PLAN_LOADING -> PlanLoadingStep(state, viewModel::onIntent, onDone = onComplete, modifier = bodyModifier)
            }
        }
    }
}
