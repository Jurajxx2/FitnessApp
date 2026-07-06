package com.coachfoska.app.ui.onboarding.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * 120dp circular progress 0→100% over [durationMs], staggered data rows, then a "done" check.
 * Calls [onFinished] once the animation completes (the screen waits for save via state, not here).
 */
@Composable
fun PlanLoadingAnimation(
    rows: List<String>,
    durationMs: Int = 4000,
    rowStaggerMs: Long = 500L,
    onFinished: () -> Unit,
    modifier: Modifier = Modifier
) {
    val progress = remember { Animatable(0f) }
    var visibleRows by remember { mutableStateOf(0) }
    val accent = MaterialTheme.colorScheme.primary
    val track = MaterialTheme.colorScheme.surfaceVariant

    LaunchedEffect(Unit) {
        rows.indices.forEach { i ->
            delay(rowStaggerMs)
            visibleRows = i + 1
        }
    }
    LaunchedEffect(Unit) {
        progress.animateTo(1f, tween(durationMs))
        onFinished()
    }

    Column(modifier.fillMaxWidth().padding(DsTheme.spacing.xl), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(120.dp)) {
            Canvas(Modifier.size(120.dp)) {
                drawArc(color = track, startAngle = -90f, sweepAngle = 360f, useCenter = false, style = Stroke(width = 10f))
                drawArc(color = accent, startAngle = -90f, sweepAngle = 360f * progress.value, useCenter = false, style = Stroke(width = 10f))
            }
            if (progress.value >= 1f) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = accent, modifier = Modifier.size(48.dp))
            } else {
                Text("${(progress.value * 100).toInt()}%", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
            }
        }
        Column(Modifier.padding(top = DsTheme.spacing.xxl).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.md)) {
            rows.forEachIndexed { i, row ->
                AnimatedVisibility(visible = i < visibleRows, enter = fadeIn() + slideInVertically()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Check, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
                        Text(row, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(start = 10.dp))
                    }
                }
            }
        }
    }
}
