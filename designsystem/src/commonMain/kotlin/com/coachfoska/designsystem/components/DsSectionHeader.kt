package com.coachfoska.designsystem.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.coachfoska.designsystem.theme.DsTheme

@Composable
fun DsSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            style = DsTheme.type.titleMedium,
            fontWeight = FontWeight.Bold,
            color = DsTheme.colors.textPrimary,
            letterSpacing = 1.5.sp,
        )
        if (actionLabel != null && onAction != null) {
            Text(
                text = actionLabel.uppercase(),
                style = DsTheme.type.labelLarge,
                color = DsTheme.colors.actionPrimary,
                letterSpacing = 1.sp,
                modifier = Modifier.minimumInteractiveComponentSize().clickable(onClick = onAction),
            )
        }
    }
}

@Composable
fun DsSectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = DsTheme.type.labelMedium,
        color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
        letterSpacing = 1.5.sp,
        modifier = modifier,
    )
}
