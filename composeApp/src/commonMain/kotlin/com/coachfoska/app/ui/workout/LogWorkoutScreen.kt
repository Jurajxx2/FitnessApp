package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun LogWorkoutRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.workoutLoggedSuccess) {
        if (state.workoutLoggedSuccess) {
            viewModel.onIntent(WorkoutIntent.WorkoutLogged)
            onBackClick()
        }
    }

    LogWorkoutScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@Composable
fun LogWorkoutScreen(
    state: WorkoutState,
    onIntent: (WorkoutIntent) -> Unit,
    onBackClick: () -> Unit
) {
    var workoutName by remember { mutableStateOf("") }
    var durationMinutes by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var exercises by remember { mutableStateOf(listOf(ExerciseLog("", "", "", 0, null, null, null))) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "Log Workout", onBackClick = onBackClick)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CoachTextField(
                value = workoutName,
                onValueChange = { workoutName = it },
                label = "Workout name"
            )
            CoachTextField(
                value = durationMinutes,
                onValueChange = { durationMinutes = it },
                label = "Duration (minutes)",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            CoachSectionHeader(text = "EXERCISES")

            exercises.forEachIndexed { i, exercise ->
                ExerciseLogRow(
                    exercise = exercise,
                    onUpdate = { updated ->
                        exercises = exercises.toMutableList().also { it[i] = updated }
                    }
                )
            }

            TextButton(
                onClick = { exercises = exercises + ExerciseLog("", "", "", 0, null, null, null) }
            ) {
                Text(
                    "+ ADD EXERCISE",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    fontSize = 13.sp
                )
            }

            CoachTextField(
                value = notes,
                onValueChange = { notes = it },
                label = "Notes (optional)",
                singleLine = false
            )

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }

            CoachButton(
                text = "SAVE WORKOUT",
                onClick = {
                    onIntent(
                        WorkoutIntent.LogWorkout(
                            workoutId = null,
                            workoutName = workoutName,
                            durationMinutes = durationMinutes.toIntOrNull() ?: 0,
                            notes = notes.ifBlank { null },
                            exerciseLogs = exercises.filter { it.exerciseName.isNotBlank() }
                        )
                    )
                },
                enabled = workoutName.isNotBlank(),
                isLoading = state.isLogging
            )
        }
    }
}

@Composable
private fun ExerciseLogRow(exercise: ExerciseLog, onUpdate: (ExerciseLog) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.04f),
                RoundedCornerShape(8.dp)
            )
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CoachTextField(
            value = exercise.exerciseName,
            onValueChange = { onUpdate(exercise.copy(exerciseName = it)) },
            label = "Exercise name"
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CoachTextField(
                value = exercise.setsCompleted.takeIf { it > 0 }?.toString() ?: "",
                onValueChange = { onUpdate(exercise.copy(setsCompleted = it.toIntOrNull() ?: 0)) },
                label = "Sets",
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )
            CoachTextField(
                value = exercise.weightKg?.toString() ?: "",
                onValueChange = { onUpdate(exercise.copy(weightKg = it.toFloatOrNull())) },
                label = "Weight (kg)",
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
        }
    }
}
