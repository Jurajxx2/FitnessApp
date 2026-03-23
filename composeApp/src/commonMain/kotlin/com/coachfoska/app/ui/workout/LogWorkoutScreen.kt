package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
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

@OptIn(ExperimentalMaterial3Api::class)
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("LOG SESSION", style = MaterialTheme.typography.labelLarge, letterSpacing = 1.sp) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CoachTextField(
                    value = workoutName,
                    onValueChange = { workoutName = it },
                    label = "Workout Name (e.g. Upper Body A)"
                )
                CoachTextField(
                    value = durationMinutes,
                    onValueChange = { durationMinutes = it },
                    label = "Duration (minutes)",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
            }

            CoachSectionHeader(text = "EXERCISES")

            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                exercises.forEachIndexed { i, exercise ->
                    ExerciseLogRow(
                        index = i + 1,
                        exercise = exercise,
                        onUpdate = { updated ->
                            exercises = exercises.toMutableList().also { it[i] = updated }
                        },
                        onRemove = if (exercises.size > 1) {
                            { exercises = exercises.toMutableList().also { it.removeAt(i) } }
                        } else null,
                        onCaptureVideo = {
                            // Mocking video capture by setting a dummy URL
                            exercises = exercises.toMutableList().also { 
                                it[i] = it[i].copy(videoUrl = "local_captured_video_${i}.mp4")
                            }
                        }
                    )
                }
            }

            OutlinedButton(
                onClick = { exercises = exercises + ExerciseLog("", "", "", 0, null, null, null) },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onBackground),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f))
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("ADD EXERCISE", style = MaterialTheme.typography.labelLarge)
            }

            CoachTextField(
                value = notes,
                onValueChange = { notes = it },
                label = "Notes (optional)",
                singleLine = false
            )

            state.error?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            Spacer(modifier = Modifier.height(16.dp))

            CoachButton(
                text = "SAVE SESSION",
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
                enabled = workoutName.isNotBlank() && exercises.any { it.exerciseName.isNotBlank() },
                isLoading = state.isLogging
            )
            
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun ExerciseLogRow(
    index: Int,
    exercise: ExerciseLog,
    onUpdate: (ExerciseLog) -> Unit,
    onRemove: (() -> Unit)?,
    onCaptureVideo: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "EXERCISE #$index",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
                
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Video capture button
                    IconButton(
                        onClick = onCaptureVideo,
                        modifier = Modifier.size(32.dp),
                        colors = IconButtonDefaults.iconButtonColors(
                            containerColor = if (exercise.videoUrl != null) 
                                MaterialTheme.colorScheme.onBackground 
                            else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                            contentColor = if (exercise.videoUrl != null) 
                                MaterialTheme.colorScheme.background 
                            else MaterialTheme.colorScheme.onBackground
                        )
                    ) {
                        Icon(
                            imageVector = if (exercise.videoUrl != null) Icons.Default.Check else Icons.Default.Videocam,
                            contentDescription = "Capture Video",
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    if (onRemove != null) {
                        IconButton(onClick = onRemove, modifier = Modifier.size(24.dp)) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Remove",
                                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
            
            CoachTextField(
                value = exercise.exerciseName,
                onValueChange = { onUpdate(exercise.copy(exerciseName = it)) },
                label = "Exercise Name"
            )
            
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
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
}
