package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryState
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryViewModel
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun PostWorkoutSummaryRoute(
    userId: String,
    logId: String,
    onDone: () -> Unit,
    viewModel: PostWorkoutSummaryViewModel = koinViewModel { parametersOf(userId, logId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    PostWorkoutSummaryScreen(state = state, onDone = onDone)
}

@Composable
fun PostWorkoutSummaryScreen(
    state: PostWorkoutSummaryState,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (state.isLoading) {
            CircularProgressIndicator()
            return@Column
        }

        Text("🎉", fontSize = 48.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Workout Complete!",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
        )

        Spacer(Modifier.height(24.dp))

        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = state.workoutName,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                )
                Text(
                    text = state.dateDisplay,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                SummaryStatRow("⏱", "${state.durationMinutes} min")
                SummaryStatRow("📊", "${formatWeightKg(state.totalVolumeKg)} kg volume")
                SummaryStatRow("✅", "${state.setsCompleted}/${state.setsTotal} sets")
                SummaryStatRow("💪", "${state.exerciseCount} exercises")

                if (state.personalRecords.isNotEmpty()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text(
                        text = "🏆 ${state.personalRecords.size} Personal Records",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary,
                    )
                    state.personalRecords.forEach { pr ->
                        Text(
                            text = "${pr.exerciseName} ${pr.record}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = onDone,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("DONE")
        }
    }
}

@Composable
private fun SummaryStatRow(emoji: String, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(emoji, fontSize = 16.sp)
        Text(text, style = MaterialTheme.typography.bodyLarge)
    }
}
