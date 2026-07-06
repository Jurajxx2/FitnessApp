package com.coachfoska.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.designsystem.brand.foska.FoskaBrand
import com.coachfoska.designsystem.theme.DsTheme

@Composable
fun DsHubIconCard(
    icon: ImageVector,
    eyebrow: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: String? = null
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = DsTheme.shapes.xxl,
        color = DsTheme.colors.surfaceElevated
    ) {
        Box {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = DsTheme.colors.actionPrimary.copy(alpha = 0.5f)
                )
            }

            badge?.let {
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp),
                    shape = DsTheme.shapes.full,
                    color = DsTheme.colors.actionPrimary.copy(alpha = 0.1f)
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        style = DsTheme.type.labelSmall,
                        color = DsTheme.colors.actionPrimary,
                        letterSpacing = 1.sp
                    )
                }
            }

            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = eyebrow.uppercase(),
                    style = DsTheme.type.labelSmall,
                    color = DsTheme.colors.textSecondary.copy(alpha = 0.6f),
                    letterSpacing = 1.5.sp
                )
                Text(
                    text = title.uppercase(),
                    style = DsTheme.type.headlineSmall.copy(fontWeight = FontWeight.ExtraBold),
                    color = DsTheme.colors.textSecondary,
                    letterSpacing = (-0.3).sp
                )
                Text(
                    text = subtitle,
                    style = DsTheme.type.bodySmall,
                    color = DsTheme.colors.textSecondary.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Preview
@Composable
fun DsHubIconCardPreview() {
    DsTheme(brand = FoskaBrand, darkTheme = true) {
        DsHubIconCard(
            icon = Icons.Default.Add,
            eyebrow = "Log",
            title = "Log Activity",
            subtitle = "Walk, run, swim...",
            onClick = {},
            modifier = Modifier.size(width = 300.dp, height = 160.dp)
        )
    }
}

@Preview
@Composable
fun DsHubIconCardWithBadgePreview() {
    DsTheme(brand = FoskaBrand, darkTheme = true) {
        DsHubIconCard(
            icon = Icons.Default.Add,
            eyebrow = "Log",
            title = "Log Activity",
            subtitle = "Walk, run, swim...",
            badge = "NEW",
            onClick = {},
            modifier = Modifier.size(width = 300.dp, height = 160.dp)
        )
    }
}
