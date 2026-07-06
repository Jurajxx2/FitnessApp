package com.coachfoska.app.ui.onboarding.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp

@Composable
fun SelectableChip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val bg = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
    val fg = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onBackground
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = fg,
        modifier = modifier
            .background(bg, RectangleShape)
            .border(1.dp, MaterialTheme.colorScheme.outline, RectangleShape)
            .clickable(onClick = onClick)
            .defaultMinSize(minHeight = DsTheme.sizes.touchTarget)
            .padding(horizontal = DsTheme.spacing.lg, vertical = 10.dp)
    )
}
