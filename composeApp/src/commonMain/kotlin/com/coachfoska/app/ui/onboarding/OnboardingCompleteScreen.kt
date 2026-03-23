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
import com.coachfoska.app.ui.components.CoachButton

@Composable
fun OnboardingCompleteScreen(
    state: OnboardingState,
    onIntent: (OnboardingIntent) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Spacer(modifier = Modifier.height(80.dp))

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "You're all set!",
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.displayLarge,
                textAlign = TextAlign.Center
            )
            Text(
                text = "Your personalized program is ready.\nLet's get to work.",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
                lineHeight = 24.sp
            )

            state.error?.let {
                Text(text = it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            Spacer(modifier = Modifier.height(16.dp))

            state.selectedGoal?.let { SummaryRow(label = "Goal", value = it.displayName) }
            if (state.heightInput.isNotBlank()) SummaryRow(label = "Height", value = "${state.heightInput} cm")
            if (state.weightInput.isNotBlank()) SummaryRow(label = "Weight", value = "${state.weightInput} kg")
            state.selectedActivityLevel?.let { SummaryRow(label = "Activity", value = it.displayName) }
        }

        CoachButton(
            text = "LET'S START",
            onClick = { onIntent(OnboardingIntent.CompleteOnboarding) },
            isLoading = state.isLoading
        )
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 14.sp
        )
        Text(
            text = value,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 14.sp,
            style = MaterialTheme.typography.titleSmall
        )
    }
}
