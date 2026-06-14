package com.coachfoska.app.ui.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

/**
 * PLACEHOLDER onboarding host. The real HorizontalPager-driven quiz host is implemented in a
 * follow-up task; this minimal version exists only so the UserGoal→FitnessGoal migration compiles.
 * The [viewModel] default resolves the VM through Koin, exercising the DI wiring at runtime.
 */
@Composable
fun OnboardingRoute(
    userId: String,
    onComplete: () -> Unit,
    onLoginClick: () -> Unit,
    viewModel: OnboardingViewModel = koinViewModel { parametersOf(userId) }
) {
    Box(Modifier.fillMaxSize())
}
