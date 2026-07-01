package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.usecase.workout.formatVolumeKg

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun WeeklyActivitySection(
    days: List<WeekDayActivity>,
    todayWorkout: Workout?,
    volumeKg: Double?,
    onTodayClick: (() -> Unit)? = null,
    onDayClick: (WeekDayActivity) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "WEEKLY ACTIVITY",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 1.5.sp,
        )
        WeeklyActivityGrid(days = days, onDayClick = onDayClick)
        DaySummaryBar(todayWorkout = todayWorkout, volumeKg = volumeKg, onClick = onTodayClick)
    }
}

@Composable
private fun DaySummaryBar(todayWorkout: Workout?, volumeKg: Double?, onClick: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), SquareShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (todayWorkout != null) "TODAY'S FOCUS" else "REST DAY",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp,
            )
            Text(
                text = todayWorkout?.name?.uppercase() ?: "Recovery — no workout scheduled",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
        if (todayWorkout != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                SummaryMetric("DURATION", "${todayWorkout.durationMinutes}m")
                SummaryMetric("EXERCISES", todayWorkout.exercises.size.toString())
                if (volumeKg != null) {
                    SummaryMetric("VOLUME", formatVolumeKg(volumeKg))
                }
            }
        }
    }
}

@Composable
private fun SummaryMetric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.End) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 1.sp)
        Text(value, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground)
    }
}
