package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.onboarding.components.PlanLoadingAnimation
import kotlinx.coroutines.delay
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

/**
 * Drives [OnboardingIntent.CompleteOnboarding] on first composition, animates, and waits for both the
 * animation and the save (state.isCompleted) before calling [onDone]. Shows a retry on error.
 */
@Composable
fun PlanLoadingStep(state: OnboardingState, onIntent: (OnboardingIntent) -> Unit, onDone: () -> Unit, modifier: Modifier = Modifier) {
    var animationDone by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { onIntent(OnboardingIntent.CompleteOnboarding) }
    LaunchedEffect(animationDone, state.isCompleted) {
        if (animationDone && state.isCompleted) {
            delay(1000)
            onDone()
        }
    }

    val rows = listOf(
        state.data.goal?.displayName,
        state.data.experienceLevel?.name,
        state.data.equipment?.name,
        "${state.data.frequencyPerWeek}× / week"
    ).filterNotNull()

    Column(modifier.fillMaxSize().padding(Spacing.xl), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.weight(1f))
        val headline = if (state.isCompleted && animationDone)
            stringResource(Res.string.ob_loading_done)
        else
            stringResource(Res.string.ob_loading_preparing, state.data.name)
        Text(headline, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = Spacing.xl))
        if (state.error != null) {
            Text(stringResource(Res.string.ob_loading_error), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
            CoachButton(text = stringResource(Res.string.ob_loading_retry), onClick = { animationDone = false; onIntent(OnboardingIntent.CompleteOnboarding) }, shape = RectangleShape, modifier = Modifier.padding(top = Spacing.lg))
        } else {
            PlanLoadingAnimation(rows = rows, onFinished = { animationDone = true })
        }
        Spacer(Modifier.weight(1f))
    }
}
