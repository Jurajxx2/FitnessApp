package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.weekly_activity_day_status_cd
import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.ui.components.localizedName
import org.jetbrains.compose.resources.stringResource

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun WeeklyActivityGrid(
    days: List<WeekDayActivity>,
    onDayClick: (WeekDayActivity) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        days.forEach { day ->
            WeekDayCell(day = day, onClick = { onDayClick(day) }, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun WeekDayCell(day: WeekDayActivity, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val isToday = day.status == DayActivityStatus.TODAY
    val dimmed = day.status == DayActivityStatus.REST || day.status == DayActivityStatus.MISSED
    val border = if (isToday) {
        BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
    } else {
        BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    }
    val bg = when (day.status) {
        DayActivityStatus.TODAY -> MaterialTheme.colorScheme.surfaceContainerHighest
        DayActivityStatus.COMPLETED -> MaterialTheme.colorScheme.surface
        else -> MaterialTheme.colorScheme.background
    }
    val accent = if (isToday) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        modifier = modifier
            .border(border, SquareShape)
            .background(bg)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp)
            .alpha(if (dimmed) 0.5f else 1f),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = day.dayOfWeek.localizedName().first().toString(),
            style = MaterialTheme.typography.labelSmall,
            color = accent,
        )
        Icon(
            imageVector = iconFor(day.status),
            contentDescription = stringResource(
                Res.string.weekly_activity_day_status_cd,
                day.dayOfWeek.localizedName(),
                day.status.name.lowercase(),
            ),
            tint = accent,
            modifier = Modifier.size(20.dp),
        )
    }
}

private fun iconFor(status: DayActivityStatus): ImageVector = when (status) {
    DayActivityStatus.COMPLETED -> Icons.Filled.CheckCircle
    DayActivityStatus.TODAY -> Icons.Filled.Bolt
    DayActivityStatus.SCHEDULED -> Icons.Filled.CalendarToday
    DayActivityStatus.MISSED -> Icons.Filled.CalendarToday
    DayActivityStatus.REST -> Icons.Filled.Hotel
}
