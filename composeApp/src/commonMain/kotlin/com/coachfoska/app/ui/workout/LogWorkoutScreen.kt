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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachTopBar

@Composable
fun LogWorkoutScreen(
    workoutViewModel: WorkoutViewModel,
    onBackClick: () -> Unit
) {
    val state by workoutViewModel.state.collectAsStateWithLifecycle()

    var workoutName by remember { mutableStateOf("") }
    var durationMinutes by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var exercises by remember {
        mutableStateOf(listOf(ExerciseLog("", "", "", 0, null, null, null)))
    }

    LaunchedEffect(state.workoutLoggedSuccess) {
        if (state.workoutLoggedSuccess) {
            workoutViewModel.onIntent(WorkoutIntent.WorkoutLogged)
            onBackClick()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        CoachTopBar(title = "Log Workout", onBackClick = onBackClick)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            LogTextField(value = workoutName, onValueChange = { workoutName = it }, label = "Workout name")
            LogTextField(
                value = durationMinutes,
                onValueChange = { durationMinutes = it },
                label = "Duration (minutes)",
                keyboardType = KeyboardType.Number
            )

            Text("EXERCISES", color = Color(0xFFA90707), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.5.sp)

            exercises.forEachIndexed { i, exercise ->
                ExerciseLogRow(
                    exercise = exercise,
                    onUpdate = { updated ->
                        exercises = exercises.toMutableList().also { it[i] = updated }
                    }
                )
            }

            TextButton(onClick = {
                exercises = exercises + ExerciseLog("", "", "", 0, null, null, null)
            }) {
                Text("+ ADD EXERCISE", color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp)
            }

            LogTextField(value = notes, onValueChange = { notes = it }, label = "Notes (optional)", singleLine = false)

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }

            Button(
                onClick = {
                    workoutViewModel.onIntent(
                        WorkoutIntent.LogWorkout(
                            workoutId = null,
                            workoutName = workoutName,
                            durationMinutes = durationMinutes.toIntOrNull() ?: 0,
                            notes = notes.ifBlank { null },
                            exerciseLogs = exercises.filter { it.exerciseName.isNotBlank() }
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707)),
                enabled = workoutName.isNotBlank() && !state.isLogging
            ) {
                if (state.isLogging) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("SAVE WORKOUT", fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
                }
            }
        }
    }
}

@Composable
private fun ExerciseLogRow(exercise: ExerciseLog, onUpdate: (ExerciseLog) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        LogTextField(
            value = exercise.exerciseName,
            onValueChange = { onUpdate(exercise.copy(exerciseName = it)) },
            label = "Exercise name"
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LogTextField(
                value = exercise.setsCompleted.takeIf { it > 0 }?.toString() ?: "",
                onValueChange = { onUpdate(exercise.copy(setsCompleted = it.toIntOrNull() ?: 0)) },
                label = "Sets",
                modifier = Modifier.weight(1f),
                keyboardType = KeyboardType.Number
            )
            LogTextField(
                value = exercise.weightKg?.toString() ?: "",
                onValueChange = { onUpdate(exercise.copy(weightKg = it.toFloatOrNull())) },
                label = "Weight (kg)",
                modifier = Modifier.weight(1f),
                keyboardType = KeyboardType.Decimal
            )
        }
    }
}

@Composable
private fun LogTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label, color = Color.White.copy(alpha = 0.6f)) },
        singleLine = singleLine,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedBorderColor = Color(0xFFA90707),
            unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
            cursorColor = Color(0xFFA90707)
        )
    )
}
