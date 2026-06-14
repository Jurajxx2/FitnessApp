package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.onboarding.components.FrequencySlider
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun FrequencyStep(state: OnboardingState, onIntent: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val freq = state.data.frequencyPerWeek
    val label = when (freq) {
        1 -> stringResource(Res.string.ob_frequency_1)
        2 -> stringResource(Res.string.ob_frequency_2)
        3, 4 -> stringResource(Res.string.ob_frequency_recommended)
        5 -> stringResource(Res.string.ob_frequency_5)
        6 -> stringResource(Res.string.ob_frequency_6)
        else -> stringResource(Res.string.ob_frequency_7)
    }
    Column(modifier.fillMaxSize().padding(top = 16.dp, bottom = 24.dp)) {
        Text(stringResource(Res.string.ob_frequency_title), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onBackground)
        Text(stringResource(Res.string.ob_frequency_subtitle), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
        Box(Modifier.weight(1f)) {
            FrequencySlider(
                value = freq,
                label = label,
                daysSuffix = stringResource(Res.string.ob_frequency_days),
                habitLabel = stringResource(Res.string.ob_frequency_habit),
                progressLabel = stringResource(Res.string.ob_frequency_progress),
                recommended = freq in 3..4,
                onValueChange = { onIntent(OnboardingIntent.SetFrequency(it)) }
            )
        }
        CoachButton(text = stringResource(Res.string.ob_continue), onClick = { onIntent(OnboardingIntent.NextStep) }, shape = RectangleShape, modifier = Modifier.fillMaxWidth())
    }
}
