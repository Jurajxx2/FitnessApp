package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutDetailRoute(
    workoutId: String,
    userId: String,
    onBackClick: () -> Unit,
    onExerciseClick: (Int) -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        viewModel.onIntent(WorkoutIntent.SelectWorkout(workoutId))
    }

    WorkoutDetailScreen(
        state = state,
        onBackClick = onBackClick,
        onExerciseClick = onExerciseClick
    )
}

@Composable
fun WorkoutDetailScreen(
    state: WorkoutState,
    onBackClick: () -> Unit,
    onExerciseClick: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = state.selectedWorkout?.name ?: "Workout", onBackClick = onBackClick)

        if (state.isLoading) {
            CoachLoadingBox()
        } else {
            state.selectedWorkout?.let { workout ->
                LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                    itemsIndexed(workout.exercises.sortedBy { it.sortOrder }) { index, exercise ->
                        ExerciseRow(
                            index = index + 1,
                            exercise = exercise,
                            onClick = { exercise.wgerExerciseId?.let { onExerciseClick(it) } }
                        )
                        if (index < workout.exercises.size - 1) {
                            HorizontalDivider(
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExerciseRow(index: Int, exercise: WorkoutExercise, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "$index",
            color = MaterialTheme.colorScheme.primary,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(24.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = exercise.name,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
            exercise.muscleGroup?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
        Text(
            text = "${exercise.sets} × ${exercise.reps}",
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
            fontSize = 14.sp
        )
    }
}
