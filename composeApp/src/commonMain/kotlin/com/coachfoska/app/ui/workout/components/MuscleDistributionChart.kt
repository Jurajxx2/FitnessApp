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
import com.coachfoska.app.theme.muscleGroupColor

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
            val color = muscleGroupColor(entry.muscleGroup)
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
