package com.coachfoska.app.ui.nutrition.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.macro_ring_carbs
import coachfoska.composeapp.generated.resources.macro_ring_fat
import coachfoska.composeapp.generated.resources.macro_ring_protein
import org.jetbrains.compose.resources.stringResource

private const val DAILY_CALORIE_TARGET = 2000f

@Composable
fun MacroRingSummary(
    calories: Float,
    proteinG: Float,
    carbsG: Float,
    fatG: Float,
    modifier: Modifier = Modifier,
) {
    val targetFraction = (calories / DAILY_CALORIE_TARGET).coerceIn(0f, 1f)
    val fraction by animateFloatAsState(targetValue = targetFraction, label = "macro-ring")

    val gradient = Brush.linearGradient(
        colors = listOf(
            MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
            MaterialTheme.colorScheme.primary.copy(alpha = 0.02f),
        ),
    )
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(gradient, RoundedCornerShape(16.dp))
            .padding(PaddingValues(horizontal = 16.dp, vertical = 12.dp)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(72.dp)) {
            CircularProgressIndicator(
                progress = { fraction },
                modifier = Modifier.size(72.dp),
                strokeWidth = 6.dp,
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f),
            )
            Text(
                text = "${calories.toInt()}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            MacroLine(label = stringResource(Res.string.macro_ring_carbs),   grams = carbsG)
            MacroLine(label = stringResource(Res.string.macro_ring_protein), grams = proteinG)
            MacroLine(label = stringResource(Res.string.macro_ring_fat),     grams = fatG)
        }
    }
}

@Composable
private fun MacroLine(label: String, grams: Float) {
    val animated by animateFloatAsState(targetValue = grams, label = "macro-$label")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
        )
        Text(
            text = "${animated.toInt()}g",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
