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
import coachfoska.composeapp.generated.resources.progress_workouts_per_week
import com.coachfoska.app.domain.model.WeeklyCount
import org.jetbrains.compose.resources.stringResource

@Composable
fun WorkoutsPerWeekChart(
    data: List<WeeklyCount>,
    modifier: Modifier = Modifier,
) {
    if (data.isEmpty()) return

    val maxCount = data.maxOf { it.count }.coerceAtLeast(1)

    Column(modifier = modifier) {
        Text(
            text = stringResource(Res.string.progress_workouts_per_week),
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth().height(80.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            data.forEach { week ->
                val fraction = week.count.toFloat() / maxCount
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            // A zero-workout week must be visually empty. A minimum bar made
                            // missed weeks look like completed training in the old chart.
                            .fillMaxHeight(fraction.coerceIn(0f, 1f))
                            .background(DsTheme.colors.chartLine, RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)),
                    )
                }
            }
        }
    }
}
