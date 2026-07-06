package com.coachfoska.app.ui.onboarding.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.dp
import androidx.compose.ui.tooling.preview.Preview
import com.coachfoska.app.theme.CoachFoskaTheme

@Composable
fun OnboardingProgressBar(progress: Float, modifier: Modifier = Modifier) {
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), tween(300), label = "ob-progress")
    Box(
        modifier
            .fillMaxWidth()
            .height(4.dp)
            .clip(RectangleShape)
            .background(DsTheme.colors.surfaceElevated)
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .layout { measurable, constraints ->
                    val width = (constraints.maxWidth * animated).toInt()
                    val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
                    layout(placeable.width, placeable.height) { placeable.place(0, 0) }
                }
                .background(DsTheme.colors.actionPrimary)
        )
    }
}

@Preview
@Composable
private fun OnboardingProgressBarPreview() {
    CoachFoskaTheme { OnboardingProgressBar(progress = 0.4f) }
}
