package com.coachfoska.app.ui.profile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.presentation.profile.ProfileIntent
import com.coachfoska.app.presentation.profile.ProfileState
import com.coachfoska.app.presentation.profile.ProfileViewModel
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachSectionHeader
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ProgressRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: ProfileViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(ProfileIntent.LoadWeightHistory)
    }

    ProgressScreen(state = state, onBackClick = onBackClick)
}

@Composable
fun ProgressScreen(
    state: ProfileState,
    onBackClick: () -> Unit
) {
    if (state.isWeightHistoryLoading) {
        CoachLoadingBox()
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
                // Weight Progress Card
                if (state.weightHistory.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = stringResource(Res.string.weight_evolution),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                            letterSpacing = 1.5.sp
                        )
                        
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.onBackground,
                            contentColor = MaterialTheme.colorScheme.background,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                                WeightChart(
                                    entries = state.weightHistory.take(12).reversed(),
                                    color = MaterialTheme.colorScheme.background
                                )
                                
                                val first = state.weightHistory.lastOrNull()?.weightKg
                                val last = state.weightHistory.firstOrNull()?.weightKg
                                if (first != null && last != null) {
                                    val diff = last - first
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Bottom
                                    ) {
                                        Column {
                                            Text(stringResource(Res.string.progress_start), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(stringResource(Res.string.weight_kg_format, first), style = MaterialTheme.typography.titleMedium)
                                        }
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(stringResource(Res.string.progress_current), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(stringResource(Res.string.weight_kg_format, last), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(stringResource(Res.string.progress_change), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
                                            Text(
                                                text = "${if (diff < 0) "" else "+"}${stringResource(Res.string.weight_kg_format, kotlin.math.round(diff * 10) / 10.0)}",
                                                style = MaterialTheme.typography.titleMedium,
                                                color = if (diff <= 0) Color(0xFF81C784) else Color(0xFFE57373)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Body Stats Section
                state.user?.let { user ->
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = stringResource(Res.string.body_composition),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                            letterSpacing = 1.5.sp
                        )
                        
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                user.heightCm?.let { ProgressStatRow(stringResource(Res.string.stat_height), stringResource(Res.string.height_cm_format, it.toInt())) }
                                HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
                                user.weightKg?.let { ProgressStatRow(stringResource(Res.string.stat_last_weight), stringResource(Res.string.weight_kg_upper_format, it.toString())) }
                                HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
                                user.goal?.let { ProgressStatRow(stringResource(Res.string.stat_target_goal), it.displayName.uppercase()) }
                                HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
                                user.activityLevel?.let { ProgressStatRow(stringResource(Res.string.stat_activity), it.displayName.uppercase()) }
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
}

@Composable
private fun WeightChart(entries: List<WeightEntry>, color: Color) {
    Canvas(modifier = Modifier.fillMaxWidth().height(140.dp)) {
        if (entries.size < 2) return@Canvas
        val weights = entries.map { it.weightKg }
        val minWeight = weights.min()
        val maxWeight = weights.max()
        val range = (maxWeight - minWeight).coerceAtLeast(1f)
        val stepX = size.width / (entries.size - 1).toFloat()
        val path = Path()
        
        // Draw chart line
        entries.forEachIndexed { i, entry ->
            val x = i * stepX
            val y = size.height - ((entry.weightKg - minWeight) / range * size.height * 0.7f) - size.height * 0.15f
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, color, style = Stroke(width = 3.dp.toPx()))
        
        // Draw data points
        entries.forEachIndexed { i, entry ->
            val x = i * stepX
            val y = size.height - ((entry.weightKg - minWeight) / range * size.height * 0.7f) - size.height * 0.15f
            drawCircle(color, radius = 5.dp.toPx(), center = Offset(x, y))
            drawCircle(Color.Black.copy(alpha = 0.2f), radius = 2.dp.toPx(), center = Offset(x, y))
        }
    }
}

@Composable
private fun ProgressStatRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
    }
}
