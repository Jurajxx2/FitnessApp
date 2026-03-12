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
import com.coachfoska.app.presentation.profile.ProfileViewModel
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun ProgressScreen(
    profileViewModel: ProfileViewModel,
    onBackClick: () -> Unit
) {
    val state by profileViewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        profileViewModel.onIntent(ProfileIntent.LoadWeightHistory)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        CoachTopBar(title = "My Progress", onBackClick = onBackClick)

        if (state.isWeightHistoryLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFA90707))
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Weight Chart
                if (state.weightHistory.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "WEIGHT PROGRESS",
                            color = Color(0xFFA90707),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.5.sp
                        )
                        WeightChart(entries = state.weightHistory.take(12).reversed())
                        val first = state.weightHistory.lastOrNull()?.weightKg
                        val last = state.weightHistory.firstOrNull()?.weightKg
                        if (first != null && last != null) {
                            val diff = last - first
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(text = "Start: ${first}kg", color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp)
                                Text(text = "Current: ${last}kg", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    text = "${if (diff < 0) "" else "+"}${(kotlin.math.round(diff * 10) / 10.0)}kg",
                                    color = if (diff < 0) Color(0xFF4CAF50) else Color(0xFFA90707),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                // Body Stats
                state.user?.let { user ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("BODY STATS", color = Color(0xFFA90707), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.5.sp)
                        user.heightCm?.let { StatRow("Height", "${it.toInt()} cm") }
                        user.weightKg?.let { StatRow("Current Weight", "${it} kg") }
                        user.goal?.let { StatRow("Goal", it.displayName) }
                        user.activityLevel?.let { StatRow("Activity Level", it.displayName) }
                    }
                }
            }
        }
    }
}

@Composable
private fun WeightChart(entries: List<WeightEntry>) {
    val primaryRed = Color(0xFFA90707)
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
    ) {
        if (entries.size < 2) return@Canvas
        val weights = entries.map { it.weightKg }
        val minWeight = weights.min()
        val maxWeight = weights.max()
        val range = (maxWeight - minWeight).coerceAtLeast(1f)
        val stepX = size.width / (entries.size - 1).toFloat()

        val path = Path()
        entries.forEachIndexed { i, entry ->
            val x = i * stepX
            val y = size.height - ((entry.weightKg - minWeight) / range * size.height * 0.8f) - size.height * 0.1f
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }

        drawPath(path, primaryRed, style = Stroke(width = 2.dp.toPx()))
        entries.forEachIndexed { i, entry ->
            val x = i * stepX
            val y = size.height - ((entry.weightKg - minWeight) / range * size.height * 0.8f) - size.height * 0.1f
            drawCircle(primaryRed, radius = 4.dp.toPx(), center = Offset(x, y))
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(text = label, color = Color.White.copy(alpha = 0.5f), fontSize = 14.sp)
        Text(text = value, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}
