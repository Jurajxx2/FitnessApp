package com.coachfoska.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
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
            .background(Color.Black)
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
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = "Used to calculate your nutrition and training plan.",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 14.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                StatTextField(
                    value = state.heightInput,
                    onValueChange = { onIntent(OnboardingIntent.HeightChanged(it)) },
                    label = "Height (cm)"
                )
                StatTextField(
                    value = state.weightInput,
                    onValueChange = { onIntent(OnboardingIntent.WeightChanged(it)) },
                    label = "Weight (kg)"
                )
                StatTextField(
                    value = state.ageInput,
                    onValueChange = { onIntent(OnboardingIntent.AgeChanged(it)) },
                    label = "Age"
                )

                state.error?.let {
                    Text(text = it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = onNextClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707)),
                enabled = state.heightInput.isNotBlank() &&
                    state.weightInput.isNotBlank() &&
                    state.ageInput.isNotBlank()
            ) {
                Text("CONTINUE", fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
private fun StatTextField(value: String, onValueChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label, color = Color.White.copy(alpha = 0.6f)) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedBorderColor = Color(0xFFA90707),
            unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
            cursorColor = Color(0xFFA90707)
        )
    )
}
