package com.coachfoska.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.designsystem.theme.DsTheme

enum class DsButtonVariant { Primary, Secondary, Outlined, Destructive }

@Composable
fun DsButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    enabled: Boolean = true,
    isLoading: Boolean = false,
    variant: DsButtonVariant = DsButtonVariant.Primary,
    shape: Shape = DsTheme.shapes.md,
) {
    if (variant == DsButtonVariant.Outlined) {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(DsTheme.sizes.buttonHeightCompact),
            enabled = enabled && !isLoading,
            shape = shape,
            border = BorderStroke(1.dp, DsTheme.colors.outline),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = DsTheme.colors.textPrimary,
                disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f),
            )
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = DsTheme.colors.actionPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Text(text = text, style = DsTheme.type.labelLarge)
            }
        }
        return
    }

    val colors = when (variant) {
        DsButtonVariant.Primary -> ButtonDefaults.buttonColors(
            containerColor = DsTheme.colors.actionPrimary,
            contentColor = DsTheme.colors.onActionPrimary,
            disabledContainerColor = DsTheme.colors.textPrimary.copy(alpha = 0.12f),
            disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f)
        )
        DsButtonVariant.Secondary -> ButtonDefaults.buttonColors(
            containerColor = DsTheme.colors.actionSecondary,
            contentColor = DsTheme.colors.onActionSecondary,
            disabledContainerColor = DsTheme.colors.textPrimary.copy(alpha = 0.08f),
            disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f)
        )
        DsButtonVariant.Destructive -> ButtonDefaults.buttonColors(
            containerColor = DsTheme.colors.error,
            contentColor = DsTheme.colors.onError,
            disabledContainerColor = DsTheme.colors.error.copy(alpha = 0.12f),
            disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f)
        )
        DsButtonVariant.Outlined -> error("handled above")
    }

    Button(
        onClick = onClick,
        modifier = modifier.height(DsTheme.sizes.buttonHeight),
        shape = shape,
        colors = colors,
        elevation = null,
        enabled = enabled && !isLoading
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = DsTheme.colors.onActionPrimary,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                style = DsTheme.type.labelLarge,
                letterSpacing = 1.sp
            )
        }
    }
}
