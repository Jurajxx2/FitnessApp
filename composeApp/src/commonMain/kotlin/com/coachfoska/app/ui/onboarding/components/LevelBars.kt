package com.coachfoska.app.ui.onboarding.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp

/** Four bars; [filled] of them use the primary color, the rest the outline color. */
@Composable
fun LevelBars(filled: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
        repeat(4) { i ->
            val on = i < filled
            Box(
                Modifier
                    .width(5.dp)
                    .height((10 + i * 4).dp)
                    .background(
                        if (on) DsTheme.colors.actionPrimary else DsTheme.colors.outline,
                        RectangleShape
                    )
            )
        }
    }
}
