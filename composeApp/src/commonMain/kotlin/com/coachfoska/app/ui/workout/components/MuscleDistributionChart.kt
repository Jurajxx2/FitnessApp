package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.MuscleVolumeEntry

private val chartColors = listOf(
    androidx.compose.ui.graphics.Color(0xFF4CAF50),
    androidx.compose.ui.graphics.Color(0xFF3498DB),
    androidx.compose.ui.graphics.Color(0xFF9B59B6),
    androidx.compose.ui.graphics.Color(0xFFE74C3C),
    androidx.compose.ui.graphics.Color(0xFFFF9800),
    androidx.compose.ui.graphics.Color(0xFF00BCD4),
)

@Composable
fun MuscleDistributionChart(
    entries: List<MuscleVolumeEntry>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Volume by Muscle Group",
            style = MaterialTheme.typography.titleSmall,
        )
        entries.forEachIndexed { index, entry ->
            val color = chartColors[index % chartColors.size]
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(entry.muscleGroup, style = MaterialTheme.typography.bodySmall)
                    Text("${entry.percentage.toInt()}%", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(3.dp)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (entry.percentage / 100f).coerceIn(0f, 1f))
                            .height(6.dp)
                            .background(color, RoundedCornerShape(3.dp)),
                    )
                }
            }
        }
    }
}
