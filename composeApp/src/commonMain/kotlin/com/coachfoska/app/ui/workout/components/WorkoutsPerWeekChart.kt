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
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.theme.ChartLine

@Composable
fun WorkoutsPerWeekChart(
    data: List<WeeklyCount>,
    modifier: Modifier = Modifier,
) {
    if (data.isEmpty()) return

    val maxCount = data.maxOf { it.count }.coerceAtLeast(1)

    Column(modifier = modifier) {
        Text(
            text = "Workouts Per Week",
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
                            .fillMaxHeight(fraction.coerceIn(0.05f, 1f))
                            .background(ChartLine, RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)),
                    )
                }
            }
        }
    }
}
