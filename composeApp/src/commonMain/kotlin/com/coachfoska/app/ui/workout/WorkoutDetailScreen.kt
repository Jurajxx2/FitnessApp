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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun WorkoutDetailScreen(
    workoutViewModel: WorkoutViewModel,
    workoutId: String,
    onBackClick: () -> Unit,
    onExerciseClick: (Int) -> Unit
) {
    val state by workoutViewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        workoutViewModel.onIntent(WorkoutIntent.SelectWorkout(workoutId))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        CoachTopBar(
            title = state.selectedWorkout?.name ?: "Workout",
            onBackClick = onBackClick
        )

        if (state.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFA90707))
            }
        } else {
            state.selectedWorkout?.let { workout ->
                LazyColumn(
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    itemsIndexed(workout.exercises.sortedBy { it.sortOrder }) { index, exercise ->
                        ExerciseRow(
                            index = index + 1,
                            exercise = exercise,
                            onClick = {
                                exercise.wgerExerciseId?.let { onExerciseClick(it) }
                            }
                        )
                        if (index < workout.exercises.size - 1) {
                            Divider(color = Color.White.copy(alpha = 0.08f))
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
            color = Color(0xFFA90707),
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(24.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(text = exercise.name, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            exercise.muscleGroup?.let {
                Text(text = it, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
            }
        }
        Text(
            text = "${exercise.sets} × ${exercise.reps}",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 14.sp
        )
    }
}
