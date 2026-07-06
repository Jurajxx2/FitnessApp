package com.coachfoska.designsystem.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.coachfoska.designsystem.theme.DsTheme

@Composable
fun DsChip(
    selected: Boolean,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        modifier = modifier,
        label = { Text(label, style = DsTheme.type.labelLarge) },
        leadingIcon = leadingIcon?.let {
            { Icon(it, contentDescription = null, Modifier.size(FilterChipDefaults.IconSize)) }
        },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = DsTheme.colors.actionPrimary,
            selectedLabelColor = DsTheme.colors.onActionPrimary,
            selectedLeadingIconColor = DsTheme.colors.onActionPrimary,
        ),
    )
}
