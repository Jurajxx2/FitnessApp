package com.coachfoska.designsystem.components

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.designsystem.theme.DsTheme
import com.coachfoska.designsystem.theme.LocalReduceMotion

/**
 * Big number + label + optional trend delta. If [value] is purely numeric and
 * [animateValue] is true, the number counts up on first composition, skipped
 * under reduce-motion.
 */
@Composable
fun DsMetricCard(
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
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { started = true }
    val animated by animateIntAsState(
        targetValue = if (started) numeric ?: 0 else 0,
        animationSpec = tween(if (!reduceMotion && animateValue && numeric != null) DsTheme.motion.durationLongMs else 0),
        label = "metric-countup",
    )
    val displayed = if (numeric != null && animateValue && !reduceMotion) animated.toString() else value

    Surface(
        onClick = onClick ?: {},
        enabled = onClick != null,
        shape = DsTheme.shapes.lg,
        color = DsTheme.colors.surface,
        border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(DsTheme.spacing.lg),
            verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.xs),
        ) {
            Text(
                text = displayed,
                style = DsTheme.type.metricMedium,
                color = DsTheme.colors.textPrimary,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = label.uppercase(),
                    style = DsTheme.type.labelSmall,
                    color = DsTheme.colors.textSecondary,
                    letterSpacing = 1.sp,
                )
                if (delta != null) {
                    Spacer(Modifier.width(DsTheme.spacing.sm))
                    Text(
                        text = delta,
                        style = DsTheme.type.labelSmall,
                        color = when (deltaPositive) {
                            true -> DsTheme.colors.success
                            false -> DsTheme.colors.textAccent
                            null -> DsTheme.colors.textSecondary
                        },
                    )
                }
            }
        }
    }
}
