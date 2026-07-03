package com.coachfoska.app.ui.components

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.core.util.LocalReduceMotion
import com.coachfoska.app.theme.MetricMedium
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.theme.Success
import com.coachfoska.app.theme.TextAccent

/**
 * Big number + label + optional trend delta. If [value] is purely numeric and
 * [animateValue] is true, the number counts up on first composition (spec §2.4:
 * effort-as-data — numbers in motion), skipped under reduce-motion.
 */
@Composable
fun MetricCard(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    delta: String? = null,
    deltaPositive: Boolean? = null,
    animateValue: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    val reduceMotion = LocalReduceMotion.current
    val numeric = remember(value) { value.toIntOrNull() }
    // Called unconditionally to keep Compose's slot table stable when `value`
    // flips between numeric and non-numeric; motion is gated via duration/usage.
    val animated by animateIntAsState(
        targetValue = numeric ?: 0,
        animationSpec = tween(if (!reduceMotion && animateValue && numeric != null) 700 else 0),
        label = "metric-countup",
    )
    val displayed = if (numeric != null && animateValue && !reduceMotion) animated.toString() else value

    Surface(
        onClick = onClick ?: {},
        enabled = onClick != null,
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Text(
                text = displayed,
                style = MetricMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = label.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    letterSpacing = 1.sp,
                )
                if (delta != null) {
                    Spacer(Modifier.width(Spacing.sm))
                    Text(
                        text = delta,
                        style = MaterialTheme.typography.labelSmall,
                        color = when (deltaPositive) {
                            true -> Success
                            false -> TextAccent
                            null -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
    }
}
