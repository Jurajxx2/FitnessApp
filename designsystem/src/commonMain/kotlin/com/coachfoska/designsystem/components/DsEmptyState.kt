package com.coachfoska.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.theme.DsTheme

/** One empty treatment for every screen - icon + title + message + optional action. */
@Composable
fun DsEmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = DsTheme.spacing.xl, vertical = DsTheme.spacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.md),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = DsTheme.colors.textSecondary,
        )
        Text(
            text = title,
            style = DsTheme.type.headlineSmall,
            color = DsTheme.colors.textPrimary,
            textAlign = TextAlign.Center,
        )
        Text(
            text = message,
            style = DsTheme.type.bodyMedium,
            color = DsTheme.colors.textSecondary,
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            DsButton(
                text = actionLabel,
                onClick = onAction,
                modifier = Modifier.padding(top = DsTheme.spacing.sm),
            )
        }
    }
}
