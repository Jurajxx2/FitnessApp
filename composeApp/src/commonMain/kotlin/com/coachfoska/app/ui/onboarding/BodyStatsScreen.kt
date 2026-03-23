package com.coachfoska.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun BodyStatsScreen(
    state: OnboardingState,
    onIntent: (OnboardingIntent) -> Unit,
    onBackClick: () -> Unit,
    onNextClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        CoachTopBar(title = "Body Stats", onBackClick = onBackClick)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    text = "Tell us about yourself",
                    color = MaterialTheme.colorScheme.onBackground,
                    style = MaterialTheme.typography.headlineSmall
                )
                Text(
                    text = "Used to calculate your nutrition and training plan.",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    style = MaterialTheme.typography.bodyLarge
                )

                Spacer(modifier = Modifier.height(8.dp))

                CoachTextField(
                    value = state.heightInput,
                    onValueChange = { onIntent(OnboardingIntent.HeightChanged(it)) },
                    label = "Height (cm)",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
                CoachTextField(
                    value = state.weightInput,
                    onValueChange = { onIntent(OnboardingIntent.WeightChanged(it)) },
                    label = "Weight (kg)",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
                CoachTextField(
                    value = state.ageInput,
                    onValueChange = { onIntent(OnboardingIntent.AgeChanged(it)) },
                    label = "Age",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )

                state.error?.let {
                    Text(text = it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            CoachButton(
                text = "CONTINUE",
                onClick = onNextClick,
                enabled = state.heightInput.isNotBlank() &&
                    state.weightInput.isNotBlank() &&
                    state.ageInput.isNotBlank()
            )
        }
    }
}
