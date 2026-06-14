package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * 1..7 frequency picker. [label] is the dynamic caption for the current value; [recommended] drives
 * the accent. The two recommendation bars scale with the value.
 */
@Composable
fun FrequencySlider(
    value: Int,
    label: String,
    daysSuffix: String,
    habitLabel: String,
    progressLabel: String,
    recommended: Boolean,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val accent = MaterialTheme.colorScheme.primary
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "$value",
            style = MaterialTheme.typography.displayLarge,
            color = if (recommended) accent else MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
        Text("$value $daysSuffix · $label", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.toInt().coerceIn(1, 7)) },
            valueRange = 1f..7f,
            steps = 5,
            colors = SliderDefaults.colors(
                thumbColor = accent,
                activeTrackColor = accent,
                inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.padding(vertical = 16.dp)
        )
        RecommendationBar(habitLabel, fraction = (value / 7f).coerceIn(0f, 1f))
        RecommendationBar(progressLabel, fraction = (value / 7f).coerceIn(0f, 1f))
    }
}

@Composable
private fun RecommendationBar(label: String, fraction: Float) {
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Box(
            Modifier.fillMaxWidth().height(6.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RectangleShape)
        ) {
            Box(
                Modifier.fillMaxWidth(fraction).height(6.dp)
                    .background(MaterialTheme.colorScheme.primary, RectangleShape)
            )
        }
    }
}
