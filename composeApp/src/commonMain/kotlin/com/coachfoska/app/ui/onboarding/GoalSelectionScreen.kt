package com.coachfoska.app.ui.onboarding

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun GoalSelectionScreen(
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
        CoachTopBar(title = "Your Goal", onBackClick = onBackClick)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "What is your primary goal?",
                    color = MaterialTheme.colorScheme.onBackground,
                    style = MaterialTheme.typography.headlineSmall
                )
                Text(
                    text = "This helps us personalize your program.",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    style = MaterialTheme.typography.bodyLarge
                )

                Spacer(modifier = Modifier.height(16.dp))

                UserGoal.entries.forEach { goal ->
                    GoalCard(
                        goal = goal,
                        isSelected = state.selectedGoal == goal,
                        onClick = { onIntent(OnboardingIntent.GoalSelected(goal)) }
                    )
                }
            }

            CoachButton(
                text = "CONTINUE",
                onClick = onNextClick,
                enabled = state.selectedGoal != null
            )
        }
    }
}

@Composable
private fun GoalCard(goal: UserGoal, isSelected: Boolean, onClick: () -> Unit) {
    val borderColor by animateColorAsState(
        targetValue = if (isSelected)
            MaterialTheme.colorScheme.primary
        else
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
        animationSpec = tween(200),
        label = "border_color"
    )
    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected)
            MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
        else
            MaterialTheme.colorScheme.background,
        animationSpec = tween(200),
        label = "background_color"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(8.dp)
            )
            .background(color = backgroundColor, shape = RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Text(
            text = goal.displayName,
            color = MaterialTheme.colorScheme.onBackground,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}
