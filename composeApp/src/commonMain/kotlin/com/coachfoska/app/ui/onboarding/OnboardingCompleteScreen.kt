package com.coachfoska.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
import com.coachfoska.app.ui.components.CoachButton

@Composable
fun OnboardingCompleteScreen(
    state: OnboardingState,
    onIntent: (OnboardingIntent) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Spacer(modifier = Modifier.height(64.dp))

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = stringResource(Res.string.youre_all_set),
                    style = MaterialTheme.typography.displayMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = stringResource(Res.string.onboarding_complete_desc),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    textAlign = TextAlign.Center,
                    lineHeight = 24.sp
                )

                Spacer(modifier = Modifier.height(32.dp))

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    state.selectedGoal?.let { SummaryRow(label = stringResource(Res.string.summary_goal), value = it.displayName.uppercase()) }
                    if (state.heightInput.isNotBlank()) SummaryRow(label = stringResource(Res.string.summary_height), value = stringResource(Res.string.height_cm_format, state.heightInput.toIntOrNull() ?: 0))
                    if (state.weightInput.isNotBlank()) SummaryRow(label = stringResource(Res.string.summary_weight), value = stringResource(Res.string.weight_kg_upper_format, state.weightInput))
                    state.selectedActivityLevel?.let { SummaryRow(label = stringResource(Res.string.summary_activity), value = it.displayName.uppercase()) }
                }

                state.error?.let {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                }
            }

            CoachButton(
                text = stringResource(Res.string.start_training),
                onClick = { onIntent(OnboardingIntent.CompleteOnboarding) },
                isLoading = state.isLoading,
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
            )
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 0.5.sp
        )
    }
}
