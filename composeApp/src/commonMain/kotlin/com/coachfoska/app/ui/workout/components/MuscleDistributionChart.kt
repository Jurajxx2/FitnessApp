package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.progress_volume_by_muscle
import com.coachfoska.app.domain.model.MuscleVolumeEntry
import org.jetbrains.compose.resources.stringResource

@Composable
fun MuscleDistributionChart(
    entries: List<MuscleVolumeEntry>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(Res.string.progress_volume_by_muscle),
            style = MaterialTheme.typography.titleSmall,
        )
        entries.forEachIndexed { index, entry ->
            val color = DsTheme.colors.categoricalFor(entry.muscleGroup)
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(entry.muscleGroup, style = MaterialTheme.typography.bodySmall)
                    Text("${entry.percentage.toInt()}%", style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
                }
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .background(DsTheme.colors.surfaceElevated, RoundedCornerShape(3.dp)),
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
