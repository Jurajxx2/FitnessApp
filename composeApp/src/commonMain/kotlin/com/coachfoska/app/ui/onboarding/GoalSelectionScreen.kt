package com.coachfoska.app.ui.onboarding

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalSelectionScreen(
    state: OnboardingState,
    onIntent: (OnboardingIntent) -> Unit,
    onBackClick: () -> Unit,
    onNextClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.onboarding_step_1_of_3), style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) },
                navigationIcon = {
                    if (false) { // No back on first step
                        IconButton(onClick = onBackClick) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.back_cd))
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 32.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = stringResource(Res.string.goal_screen_title),
                    style = MaterialTheme.typography.displayMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = stringResource(Res.string.goal_screen_desc),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )

                Spacer(modifier = Modifier.height(32.dp))

                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    UserGoal.entries.forEach { goal ->
                        GoalCard(
                            goal = goal,
                            isSelected = state.selectedGoal == goal,
                            onClick = { onIntent(OnboardingIntent.GoalSelected(goal)) }
                        )
                    }
                }
            }

            CoachButton(
                text = stringResource(Res.string.continue_button),
                onClick = onNextClick,
                enabled = state.selectedGoal != null,
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)
            )
        }
    }
}

@Composable
private fun GoalCard(goal: UserGoal, isSelected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.surface,
        contentColor = if (isSelected) MaterialTheme.colorScheme.background else MaterialTheme.colorScheme.onBackground,
        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = goal.displayName.uppercase(),
                style = MaterialTheme.typography.labelLarge,
                letterSpacing = 1.sp
            )
        }
    }
}
