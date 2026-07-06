package com.coachfoska.designsystem.components

import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.theme.DsTheme

@Immutable
data class DsBottomNavItem(
    val id: String,
    val icon: ImageVector,
    val label: String,
    val badgeCount: Int = 0,
)

@Composable
fun DsBottomNav(
    items: List<DsBottomNavItem>,
    selectedId: String,
    onItemSelected: (String) -> Unit,
) {
    NavigationBar(
        containerColor = DsTheme.colors.background,
        tonalElevation = 0.dp
    ) {
        items.forEach { item ->
            NavigationBarItem(
                selected = selectedId == item.id,
                onClick = { onItemSelected(item.id) },
                icon = {
                    if (item.badgeCount > 0) {
                        BadgedBox(
                            badge = { Badge { Text(item.badgeCount.coerceAtMost(99).toString()) } }
                        ) {
                            Icon(item.icon, contentDescription = item.label)
                        }
                    } else {
                        Icon(item.icon, contentDescription = item.label)
                    }
                },
                label = { Text(item.label, style = DsTheme.type.labelSmall) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = DsTheme.colors.actionPrimary,
                    selectedTextColor = DsTheme.colors.actionPrimary,
                    unselectedIconColor = DsTheme.colors.textSecondary,
                    unselectedTextColor = DsTheme.colors.textSecondary,
                    indicatorColor = DsTheme.colors.actionPrimary.copy(alpha = 0.1f)
                )
            )
        }
    }
}
