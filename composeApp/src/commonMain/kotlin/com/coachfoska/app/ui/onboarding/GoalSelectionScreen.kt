package com.coachfoska.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
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
            .background(Color.Black)
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
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = "This helps us personalize your program.",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 14.sp
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

            Button(
                onClick = onNextClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707)),
                enabled = state.selectedGoal != null
            ) {
                Text("CONTINUE", fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
private fun GoalCard(goal: UserGoal, isSelected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) Color(0xFFA90707) else Color.White.copy(alpha = 0.2f),
                shape = RoundedCornerShape(8.dp)
            )
            .background(
                color = if (isSelected) Color(0xFFA90707).copy(alpha = 0.1f) else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Text(
            text = goal.displayName,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}
