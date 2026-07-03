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
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.post_workout_complete_title
import coachfoska.composeapp.generated.resources.post_workout_done
import coachfoska.composeapp.generated.resources.progress_personal_records_format
import coachfoska.composeapp.generated.resources.summary_duration_format
import coachfoska.composeapp.generated.resources.summary_exercises_format
import coachfoska.composeapp.generated.resources.summary_sets_format
import coachfoska.composeapp.generated.resources.summary_volume_format
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryState
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryViewModel
import org.jetbrains.compose.resources.stringResource
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
            text = stringResource(Res.string.post_workout_complete_title),
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

                SummaryStatRow("⏱", stringResource(Res.string.summary_duration_format, state.durationMinutes))
                SummaryStatRow("📊", stringResource(Res.string.summary_volume_format, formatWeightKg(state.totalVolumeKg)))
                SummaryStatRow("✅", stringResource(Res.string.summary_sets_format, state.setsCompleted, state.setsTotal))
                SummaryStatRow("💪", stringResource(Res.string.summary_exercises_format, state.exerciseCount))

                if (state.personalRecords.isNotEmpty()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text(
                        text = stringResource(Res.string.progress_personal_records_format, state.personalRecords.size),
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
            Text(stringResource(Res.string.post_workout_done))
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
