package com.coachfoska.app.ui.workout

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutHistoryRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    WorkoutHistoryScreen(state = state, onBackClick = onBackClick)
}

@Composable
fun WorkoutHistoryScreen(
    state: WorkoutState,
    onBackClick: () -> Unit
) {
    var expandedId by remember { mutableStateOf<String?>(null) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "Workout History", onBackClick = onBackClick)

        if (state.isHistoryLoading) {
            CoachLoadingBox()
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
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
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
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                text = log.workoutName,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = log.loggedAt.toDisplayDateTime(),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                fontSize = 12.sp
            )
        }
        if (log.durationMinutes > 0) {
            Text(
                text = "${log.durationMinutes} min",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                fontSize = 13.sp
            )
        }
        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically(tween(200)) + fadeIn(tween(200)),
            exit = shrinkVertically(tween(150)) + fadeOut(tween(150))
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                log.exerciseLogs.forEach { exerciseLog ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = exerciseLog.exerciseName,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                            fontSize = 13.sp,
                            modifier = Modifier.weight(1f)
                        )
                        exerciseLog.weightKg?.let {
                            Text(
                                text = "${it}kg",
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
