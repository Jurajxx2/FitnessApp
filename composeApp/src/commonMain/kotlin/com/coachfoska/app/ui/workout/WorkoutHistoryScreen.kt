package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun WorkoutHistoryScreen(
    workoutViewModel: WorkoutViewModel,
    onBackClick: () -> Unit
) {
    val state by workoutViewModel.state.collectAsStateWithLifecycle()
    var expandedId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        workoutViewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        CoachTopBar(title = "Workout History", onBackClick = onBackClick)

        if (state.isHistoryLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFA90707))
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.workoutHistory) { log ->
                    WorkoutLogCard(
                        log = log,
                        isExpanded = expandedId == log.id,
                        onClick = { expandedId = if (expandedId == log.id) null else log.id }
                    )
                }
                if (state.workoutHistory.isEmpty()) {
                    item {
                        Text(
                            text = "No workouts logged yet.",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WorkoutLogCard(log: WorkoutLog, isExpanded: Boolean, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = log.workoutName,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = log.loggedAt.toDisplayDateTime(),
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 12.sp
            )
        }
        if (log.durationMinutes > 0) {
            Text(
                text = "${log.durationMinutes} min",
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 13.sp
            )
        }
        if (isExpanded) {
            log.exerciseLogs.forEach { exerciseLog ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = exerciseLog.exerciseName,
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    exerciseLog.weightKg?.let {
                        Text(
                            text = "${it}kg",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}
