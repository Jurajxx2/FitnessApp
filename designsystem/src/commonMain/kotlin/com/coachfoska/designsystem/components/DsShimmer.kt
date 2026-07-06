package com.coachfoska.designsystem.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.theme.DsTheme
import com.coachfoska.designsystem.theme.LocalReduceMotion

/** Single shimmer recipe (spec §2.3). Static placeholder under reduce-motion. */
@Composable
fun DsShimmerBox(modifier: Modifier) {
    val base = DsTheme.colors.shimmerBase
    if (LocalReduceMotion.current) {
        Spacer(modifier.clip(DsTheme.shapes.md).background(base))
        return
    }
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(
        initialValue = -300f,
        targetValue = 900f,
        animationSpec = infiniteRepeatable(
            tween(DsTheme.motion.shimmerCycleMs, easing = LinearEasing),
            RepeatMode.Restart,
        ),
        label = "shimmer-x",
    )
    val brush = Brush.linearGradient(
        colors = listOf(base, DsTheme.colors.shimmerHighlight, base),
        start = Offset(x, 0f),
        end = Offset(x + 300f, 80f),
    )
    Spacer(modifier.clip(DsTheme.shapes.md).background(brush))
}

@Composable
fun DsMetricCardSkeleton(modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(DsTheme.spacing.lg)) {
        DsShimmerBox(Modifier.fillMaxWidth(0.5f).height(32.dp))
        Spacer(Modifier.height(DsTheme.spacing.sm))
        DsShimmerBox(Modifier.fillMaxWidth(0.8f).height(12.dp))
    }
}
