package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayCompletion

@Composable
fun WeeklyCalendarStrip(
    completions: List<DayCompletion>,
    modifier: Modifier = Modifier,
) {
    val completedCount = completions.count { it.status == CompletionStatus.COMPLETED }
    val totalDays = completions.size

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "This Week",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "$completedCount/$totalDays workouts",
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.primary,
            )
        }

        Spacer(Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            completions.forEach { day ->
                val label = day.dayOfWeek.displayName.take(2)
                val bgColor = when (day.status) {
                    CompletionStatus.COMPLETED -> MaterialTheme.colorScheme.primary
                    CompletionStatus.TODAY -> MaterialTheme.colorScheme.primaryContainer
                    CompletionStatus.MISSED -> MaterialTheme.colorScheme.surfaceVariant
                    CompletionStatus.UPCOMING -> Color.Transparent
                }
                val textColor = when (day.status) {
                    CompletionStatus.COMPLETED -> MaterialTheme.colorScheme.onPrimary
                    CompletionStatus.TODAY -> MaterialTheme.colorScheme.onPrimaryContainer
                    else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                }
                val symbol = when (day.status) {
                    CompletionStatus.COMPLETED -> "✓"
                    CompletionStatus.MISSED -> "-"
                    else -> label
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp)
                        .background(bgColor, RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = symbol,
                        style = MaterialTheme.typography.labelSmall,
                        color = textColor,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}
