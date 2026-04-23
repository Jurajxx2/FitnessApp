package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutPlanRoute(
    userId: String,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    WorkoutPlanScreen(
        state = state,
        onWorkoutClick = onWorkoutClick,
        onLogWorkoutClick = onLogWorkoutClick,
        onBackClick = onBackClick
    )
}

@Composable
fun WorkoutPlanScreen(
    state: WorkoutState,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "PLAN", onBackClick = onBackClick)

        if (state.isLoading) {
            CoachLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(state.workouts) { workout ->
                    WorkoutPlanCard(workout = workout, onClick = { onWorkoutClick(workout.id) })
                }
                if (state.workouts.isEmpty()) {
                    item {
                        Text(
                            text = "No workouts assigned yet.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                        )
                    }
                }
            }

            CoachButton(
                text = "LOG SESSION",
                onClick = onLogWorkoutClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 24.dp)
            )
        }
    }
}

@Composable
private fun WorkoutPlanCard(workout: Workout, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            workout.dayOfWeek?.let {
                Text(
                    text = it.displayName.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
            }
            Text(
                text = workout.name,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${workout.exercises.size} Exercises",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                if (workout.durationMinutes > 0) {
                    androidx.compose.foundation.layout.Box(
                        modifier = Modifier
                            .size(3.dp)
                            .background(
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                                RoundedCornerShape(50)
                            )
                    )
                    Text(
                        text = "${workout.durationMinutes} Min",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}
