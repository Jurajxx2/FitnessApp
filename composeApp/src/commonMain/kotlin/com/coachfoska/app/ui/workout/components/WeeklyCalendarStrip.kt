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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.progress_this_week
import coachfoska.composeapp.generated.resources.progress_workouts_count
import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayCompletion
import com.coachfoska.app.ui.components.localizedShortName
import org.jetbrains.compose.resources.stringResource

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
                text = stringResource(Res.string.progress_this_week),
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textSecondary,
            )
            Text(
                text = stringResource(Res.string.progress_workouts_count, completedCount, totalDays),
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                color = DsTheme.colors.actionPrimary,
            )
        }

        Spacer(Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            completions.forEach { day ->
                val label = day.dayOfWeek.localizedShortName()
                val bgColor = when (day.status) {
                    CompletionStatus.COMPLETED -> DsTheme.colors.actionPrimary
                    CompletionStatus.TODAY -> DsTheme.colors.surfaceElevated
                    CompletionStatus.MISSED -> DsTheme.colors.surfaceElevated
                    CompletionStatus.UPCOMING -> Color.Transparent
                }
                val textColor = when (day.status) {
                    CompletionStatus.COMPLETED -> DsTheme.colors.onActionPrimary
                    CompletionStatus.TODAY -> DsTheme.colors.textPrimary
                    else -> DsTheme.colors.textSecondary.copy(alpha = 0.5f)
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
