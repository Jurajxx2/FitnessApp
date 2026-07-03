package com.coachfoska.app.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingStep
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.ui.onboarding.components.OnboardingTopBar
import com.coachfoska.app.ui.onboarding.screens.*
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun OnboardingRoute(
    userId: String,
    onComplete: () -> Unit,
    onExit: () -> Unit,
    viewModel: OnboardingViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val step = state.currentStepEnum

    fun handleBack() {
        when {
            step == OnboardingStep.PLAN_LOADING -> Unit              // block back while saving
            state.currentStep > 0 -> viewModel.onIntent(OnboardingIntent.PreviousStep)
            else -> onExit()
        }
    }

    OnboardingBackHandler(enabled = true) { handleBack() }

    Column(Modifier.fillMaxSize()) {
        OnboardingTopBar(
            progress = state.progress,
            showBack = step.showBack,
            onBack = { handleBack() }
        )
        AnimatedContent(
            targetState = step,
            transitionSpec = {
                val forward = targetState.ordinal > initialState.ordinal
                if (forward) {
                    (slideInHorizontally(tween(300)) { it } + fadeIn(tween(300))) togetherWith
                        (slideOutHorizontally(tween(300)) { -it } + fadeOut(tween(300)))
                } else {
                    (slideInHorizontally(tween(300)) { -it } + fadeIn(tween(300))) togetherWith
                        (slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)))
                }
            },
            modifier = Modifier.fillMaxSize(),
            label = "ob-step"
        ) { current ->
            Box(Modifier.fillMaxSize()) {
                val bodyModifier = Modifier.padding(horizontal = Spacing.xl)
                when (current) {
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
}
