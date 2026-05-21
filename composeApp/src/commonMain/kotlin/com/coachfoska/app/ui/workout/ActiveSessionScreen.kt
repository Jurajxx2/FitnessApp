package com.coachfoska.app.ui.workout

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import kotlinx.coroutines.delay
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActiveSessionRoute(
    workoutId: String,
    userId: String,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        viewModel.onIntent(WorkoutIntent.SelectWorkout(workoutId))
    }

    LaunchedEffect(state.workoutLoggedSuccess) {
        if (state.workoutLoggedSuccess) {
            viewModel.onIntent(WorkoutIntent.WorkoutLogged)
            onBackClick()
        }
    }

    ActiveSessionScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick
    )
}

@Composable
fun ActiveSessionScreen(
    state: WorkoutState,
    onIntent: (WorkoutIntent) -> Unit,
    onBackClick: () -> Unit
) {
    val workout = state.selectedWorkout
    if (workout == null || state.isLoading) {
        CoachLoadingBox(Modifier.fillMaxSize())
        return
    }

    val exercises = remember(workout) { workout.exercises.sortedBy { it.sortOrder } }
    var currentExerciseIndex by remember { mutableStateOf(0) }
    val currentExercise = exercises.getOrNull(currentExerciseIndex)

    // Log tracking state
    var draftRows by remember(workout) {
        mutableStateOf(exercises.map { ex ->
            ActiveSessionFlatDraftRow(
                exerciseName = ex.name,
                setsCompleted = 0,
                reps = ex.reps,
                weightKg = null
            )
        })
    }

    var restTimerSeconds by remember { mutableStateOf(0) }
    var isTimerActive by remember { mutableStateOf(false) }

    LaunchedEffect(isTimerActive) {
        if (isTimerActive) {
            while (restTimerSeconds > 0) {
                delay(1000)
                restTimerSeconds--
            }
            isTimerActive = false
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(
            title = "ACTIVE SESSION",
            onBackClick = onBackClick
        )

        Column(
            modifier = Modifier.weight(1f).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            if (currentExercise != null) {
                ExerciseSessionView(
                    exercise = currentExercise,
                    log = draftRows[currentExerciseIndex],
                    onLogUpdate = { updated ->
                        draftRows = draftRows.toMutableList().also { it[currentExerciseIndex] = updated }
                    },
                    onSetComplete = {
                        restTimerSeconds = currentExercise.restSeconds
                        isTimerActive = true
                    }
                )
            }
        }

        // Bottom Navigation
        Surface(
            modifier = Modifier.fillMaxWidth(),
            tonalElevation = 2.dp,
            shadowElevation = 8.dp
        ) {
            Row(
                modifier = Modifier.padding(24.dp).navigationBarsPadding(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (currentExerciseIndex > 0) {
                    OutlinedButton(
                        onClick = { currentExerciseIndex-- },
                        modifier = Modifier.size(56.dp),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Previous")
                    }
                }

                if (currentExerciseIndex < exercises.size - 1) {
                    Button(
                        onClick = { currentExerciseIndex++ },
                        modifier = Modifier.weight(1f).height(56.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("NEXT EXERCISE")
                        Spacer(Modifier.width(8.dp))
                        Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                } else {
                    CoachButton(
                        text = "FINISH WORKOUT",
                        onClick = {
                            onIntent(
                                WorkoutIntent.LogWorkout(
                                    workoutId = workout.id,
                                    workoutName = workout.name,
                                    durationMinutes = 0, // TODO: track actual duration
                                    notes = null,
                                    exerciseLogs = activeSessionFlatRowsToExerciseLogs(draftRows.filter { it.setsCompleted > 0 })
                                )
                            )
                        },
                        modifier = Modifier.weight(1f).height(56.dp),
                        isLoading = state.isLogging
                    )
                }
            }
        }
    }

    // Rest Timer Overlay
    AnimatedVisibility(
        visible = isTimerActive,
        enter = fadeIn() + slideInVertically { it },
        exit = fadeOut() + slideOutVertically { it }
    ) {
        Box(
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background.copy(alpha = 0.95f)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val mins = restTimerSeconds / 60
                val secs = restTimerSeconds % 60
                val timeStr = "${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}"
                
                Text("REST TIME", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, letterSpacing = 2.sp)
                Spacer(Modifier.height(16.dp))
                Text(timeStr, style = MaterialTheme.typography.displayLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(48.dp))
                
                Button(
                    onClick = { isTimerActive = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.onBackground)
                ) {
                    Text("SKIP TIMER")
                }
            }
        }
    }
}

@Composable
private fun ExerciseSessionView(
    exercise: WorkoutExercise,
    log: ActiveSessionFlatDraftRow,
    onLogUpdate: (ActiveSessionFlatDraftRow) -> Unit,
    onSetComplete: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column {
            Text(
                text = exercise.name,
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${exercise.muscleGroup?.uppercase() ?: "GENERAL"}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                letterSpacing = 1.sp
            )
        }

        Surface(
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("GOAL:", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f))
                    Text("${exercise.sets} sets × ${exercise.reps} reps", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                }
                
                if (exercise.tips != null) {
                    Text(
                        text = "💡 ${exercise.tips}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }
            }
        }

        // Tracking area
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("CURRENT PERFORMANCE", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f), letterSpacing = 1.sp)
            
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CoachTextField(
                    value = log.setsCompleted.takeIf { it > 0 }?.toString() ?: "",
                    onValueChange = { onLogUpdate(log.copy(setsCompleted = it.toIntOrNull() ?: 0)) },
                    label = "SETS DONE",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                CoachTextField(
                    value = log.weightKg?.toString() ?: "",
                    onValueChange = { onLogUpdate(log.copy(weightKg = it.toFloatOrNull())) },
                    label = "WEIGHT (KG)",
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }

            Button(
                onClick = { 
                    onLogUpdate(log.copy(setsCompleted = log.setsCompleted + 1))
                    onSetComplete()
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f), contentColor = MaterialTheme.colorScheme.onBackground)
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(Modifier.width(12.dp))
                Text("LOG COMPLETED SET")
            }
        }
    }
}

private data class ActiveSessionFlatDraftRow(
    val exerciseName: String,
    val setsCompleted: Int = 0,
    val reps: String = "",
    val weightKg: Float? = null
)

private fun activeSessionFlatRowsToExerciseLogs(rows: List<ActiveSessionFlatDraftRow>): List<ExerciseLog> =
    rows.map { row ->
        val parsedReps = row.reps.trim().substringBefore('-').filter { it.isDigit() }.toIntOrNull()
        val sets = (1..row.setsCompleted).map { order ->
            SetLog(
                id = "", exerciseLogId = "", sortOrder = order,
                targetReps = parsedReps, actualReps = parsedReps,
                targetWeightKg = row.weightKg, actualWeightKg = row.weightKg,
                rpe = null,
                targetRestSeconds = null, actualRestSeconds = null,
                completed = true,
            )
        }
        ExerciseLog(
            id = "", workoutLogId = "",
            exerciseName = row.exerciseName, notes = null,
            sets = sets,
        )
    }
