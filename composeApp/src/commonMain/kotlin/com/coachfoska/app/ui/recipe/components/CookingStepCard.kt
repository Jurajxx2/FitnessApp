package com.coachfoska.app.ui.recipe.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun CookingStepCard(stepNumber: Int, instruction: String, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = DsTheme.colors.surface,
        border = BorderStroke(
            1.dp,
            DsTheme.colors.textPrimary.copy(alpha = 0.05f),
        ),
        modifier = modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 6.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(DsTheme.colors.actionPrimary, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stepNumber.toString(),
                    color = DsTheme.colors.onActionPrimary,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Text(
                text = instruction,
                modifier = Modifier.padding(top = 12.dp),
                style = MaterialTheme.typography.bodyLarge,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.85f),
                lineHeight = 26.sp,
            )
        }
    }
}
