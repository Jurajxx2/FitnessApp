package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.datetime.DayOfWeek

/**
 * A row of 7 equal-width toggle chips (Monday..Sunday). [dayLabels] must be ordered
 * Monday-first; the caller resolves the short labels from string resources.
 */
@Composable
fun WeekdayPicker(
    selected: Set<DayOfWeek>,
    dayLabels: List<Pair<DayOfWeek, String>>,
    onToggle: (DayOfWeek) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        dayLabels.forEach { (day, label) ->
            val isSelected = day in selected
            val bg = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
            val fg = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onBackground
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = fg,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .weight(1f)
                    .defaultMinSize(minHeight = 48.dp)
                    .background(bg, RectangleShape)
                    .border(1.dp, MaterialTheme.colorScheme.outline, RectangleShape)
                    .toggleable(
                        value = isSelected,
                        role = Role.Checkbox,
                        onValueChange = { onToggle(day) }
                    )
                    .padding(vertical = 14.dp)
            )
        }
    }
}
