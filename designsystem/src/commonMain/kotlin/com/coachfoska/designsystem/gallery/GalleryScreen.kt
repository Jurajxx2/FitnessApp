package com.coachfoska.designsystem.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.brand.Brand
import com.coachfoska.designsystem.brand.BrandRegistry
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsButtonVariant
import com.coachfoska.designsystem.components.DsCard
import com.coachfoska.designsystem.components.DsChip
import com.coachfoska.designsystem.components.DsEmptyState
import com.coachfoska.designsystem.components.DsMetricCard
import com.coachfoska.designsystem.components.DsMetricCardSkeleton
import com.coachfoska.designsystem.components.DsSearchField
import com.coachfoska.designsystem.components.DsSectionHeader
import com.coachfoska.designsystem.components.DsSectionLabel
import com.coachfoska.designsystem.components.DsShimmerBox
import com.coachfoska.designsystem.components.DsStatRow
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.designsystem.theme.DsTheme
import com.coachfoska.designsystem.tokens.DsColors

/**
 * Debug-only living documentation: every component in all variants/states,
 * with runtime brand + dark/light switching. Wraps itself in its own DsTheme
 * so switching here never touches the app's real theme state.
 */
@Composable
fun GalleryScreen(onBackClick: () -> Unit) {
    var brand by remember { mutableStateOf<Brand>(BrandRegistry.all.first()) }
    var dark by remember { mutableStateOf(true) }

    DsTheme(brand = brand, darkTheme = dark) {
        Column(
            modifier = Modifier.fillMaxSize().background(DsTheme.colors.background)
        ) {
            DsTopBar(title = "DS Gallery", onBackClick = onBackClick, backContentDescription = "Back")

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = DsTheme.spacing.lg),
                horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)
            ) {
                BrandRegistry.all.forEach { b ->
                    DsChip(selected = brand.id == b.id, label = b.id, onClick = { brand = b })
                }
                Spacer(Modifier.weight(1f))
                DsChip(selected = dark, label = if (dark) "dark" else "light", onClick = { dark = !dark })
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg),
                contentPadding = PaddingValues(DsTheme.spacing.lg)
            ) {
                item { DsSectionHeader(title = "Brand") }
                item {
                    DsCard {
                        DsStatRow("appName", DsTheme.strings.appName)
                        DsStatRow("coachName", DsTheme.strings.coachName)
                        DsStatRow("features.aiCoach", DsTheme.features.aiCoach.toString())
                    }
                }

                item { DsSectionHeader(title = "Colors") }
                items(colorSwatches()) { (name, selector) ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(32.dp).background(selector(DsTheme.colors)))
                        Spacer(Modifier.size(DsTheme.spacing.md))
                        Text(name, style = DsTheme.type.bodyMedium, color = DsTheme.colors.textPrimary)
                    }
                }

                item { DsSectionHeader(title = "Typography") }
                item {
                    Column {
                        Text("Display Large", style = DsTheme.type.displayLarge, color = DsTheme.colors.textPrimary)
                        Text("Headline Medium", style = DsTheme.type.headlineMedium, color = DsTheme.colors.textPrimary)
                        Text("Body Large", style = DsTheme.type.bodyLarge, color = DsTheme.colors.textPrimary)
                        Text("Label Small", style = DsTheme.type.labelSmall, color = DsTheme.colors.textSecondary)
                        Text("1234", style = DsTheme.type.metricLarge, color = DsTheme.colors.textPrimary)
                    }
                }

                item { DsSectionHeader(title = "Buttons") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        DsButton(text = "Primary", onClick = {})
                        DsButton(text = "Secondary", onClick = {}, variant = DsButtonVariant.Secondary)
                        DsButton(text = "Outlined", onClick = {}, variant = DsButtonVariant.Outlined)
                        DsButton(text = "Destructive", onClick = {}, variant = DsButtonVariant.Destructive)
                        DsButton(text = "Disabled", onClick = {}, enabled = false)
                        DsButton(text = "Loading", onClick = {}, isLoading = true)
                    }
                }

                item { DsSectionHeader(title = "Chips + Fields") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                            DsChip(selected = true, label = "Selected", onClick = {})
                            DsChip(selected = false, label = "Unselected", onClick = {}, leadingIcon = Icons.Default.Star)
                        }
                        DsTextField(value = "Value", onValueChange = {}, label = "DsTextField")
                        DsSearchField(value = "", onValueChange = {}, placeholder = "DsSearchField")
                    }
                }

                item { DsSectionHeader(title = "Cards + Metrics") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        DsMetricCard(value = "1234", label = "metric card", delta = "+5%", deltaPositive = true)
                        DsMetricCard(value = "87", label = "negative delta", delta = "-3%", deltaPositive = false)
                        DsCard {
                            Text(
                                "DsCard content",
                                style = DsTheme.type.bodyLarge,
                                color = DsTheme.colors.textPrimary,
                                modifier = Modifier.padding(DsTheme.spacing.lg),
                            )
                        }
                    }
                }

                item { DsSectionHeader(title = "Section labels") }
                item { DsSectionLabel(text = "DS SECTION LABEL") }

                item { DsSectionHeader(title = "Loading / Shimmer") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        DsShimmerBox(Modifier.fillMaxWidth().height(24.dp))
                        DsMetricCardSkeleton()
                    }
                }

                item { DsSectionHeader(title = "Empty state") }
                item {
                    DsEmptyState(
                        icon = Icons.Default.Star,
                        title = "Nothing here",
                        message = "This is the single empty treatment.",
                        actionLabel = "Action",
                        onAction = {},
                    )
                }
            }
        }
    }
}

private fun colorSwatches(): List<Pair<String, (DsColors) -> Color>> = listOf(
    "background" to { it.background },
    "surface" to { it.surface },
    "surfaceElevated" to { it.surfaceElevated },
    "textPrimary" to { it.textPrimary },
    "textSecondary" to { it.textSecondary },
    "accent" to { it.accent },
    "textAccent" to { it.textAccent },
    "actionPrimary" to { it.actionPrimary },
    "actionSecondary" to { it.actionSecondary },
    "success" to { it.success },
    "warning" to { it.warning },
    "error" to { it.error },
    "outline" to { it.outline },
    "chartLine" to { it.chartLine },
)
