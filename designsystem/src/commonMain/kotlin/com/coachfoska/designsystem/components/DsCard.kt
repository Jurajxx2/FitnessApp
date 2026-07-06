package com.coachfoska.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.theme.DsTheme

@Composable
fun DsCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    shape: Shape = DsTheme.shapes.xl,
    containerColor: Color = DsTheme.colors.surface,
    contentColor: Color = DsTheme.colors.textPrimary,
    border: BorderStroke? = BorderStroke(1.dp, DsTheme.colors.outlineSubtle),
    tonalElevation: Dp = 0.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (onClick != null) {
        Surface(
            onClick = onClick,
            modifier = modifier,
            shape = shape,
            color = containerColor,
            contentColor = contentColor,
            border = border,
            tonalElevation = tonalElevation,
            content = { Column(content = content) },
        )
    } else {
        Surface(
            modifier = modifier,
            shape = shape,
            color = containerColor,
            contentColor = contentColor,
            border = border,
            tonalElevation = tonalElevation,
            content = { Column(content = content) },
        )
    }
}
