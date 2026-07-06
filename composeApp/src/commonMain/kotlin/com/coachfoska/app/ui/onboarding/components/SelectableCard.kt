package com.coachfoska.app.ui.onboarding.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp

/** Sharp-edged selectable surface. White border + slight scale when selected. */
@Composable
fun SelectableCard(
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val scale by animateFloatAsState(
        if (selected) 1.02f else 1f,
        spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = 400f),
        label = "card-scale"
    )
    val border by animateColorAsState(
        if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
        label = "card-border"
    )
    Box(
        modifier
            .fillMaxWidth()
            .scale(scale)
            .background(MaterialTheme.colorScheme.surface, RectangleShape)
            .border(BorderStroke(if (selected) 2.dp else 1.dp, border), RectangleShape)
            .clickable(onClick = onClick)
            .heightIn(min = DsTheme.sizes.touchTarget)
            .padding(DsTheme.spacing.lg + DsTheme.spacing.xs)
    ) { content() }
}
