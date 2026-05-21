package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun GeneralActivityLogRoute(
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

    GeneralActivityLogScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeneralActivityLogScreen(
    state: WorkoutState,
    onIntent: (WorkoutIntent) -> Unit,
    onBackClick: () -> Unit
) {
    var type by remember { mutableStateOf(ActivityType.WALKING) }
    var duration by remember { mutableStateOf("") }
    var distance by remember { mutableStateOf("") }
    var rpe by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    
    var showTypePicker by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "LOG ACTIVITY", onBackClick = onBackClick)
        
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            ExposedDropdownMenuBox(
                expanded = showTypePicker,
                onExpandedChange = { showTypePicker = it }
            ) {
                CoachTextField(
                    value = type.displayName,
                    onValueChange = {},
                    enabled = false, // Replacement for readOnly
                    label = "ACTIVITY TYPE",
                    modifier = Modifier.menuAnchor(),
                )
                ExposedDropdownMenu(
                    expanded = showTypePicker,
                    onDismissRequest = { showTypePicker = false }
                ) {
                    ActivityType.entries.forEach { t ->
                        DropdownMenuItem(
                            text = { Text(t.displayName) },
                            onClick = { type = t; showTypePicker = false }
                        )
                    }
                }
            }

            CoachTextField(
                value = duration,
                onValueChange = { duration = it },
                label = "DURATION (MINUTES)",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            CoachTextField(
                value = distance,
                onValueChange = { distance = it },
                label = "DISTANCE (KM) - OPTIONAL",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )

            CoachTextField(
                value = rpe,
                onValueChange = { rpe = it },
                label = "RPE (1-10) - OPTIONAL",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            CoachTextField(
                value = notes,
                onValueChange = { notes = it },
                label = "NOTES (OPTIONAL)",
                singleLine = false,
                modifier = Modifier.heightIn(min = 100.dp)
            )

            Spacer(Modifier.weight(1f))

            CoachButton(
                text = "SAVE ACTIVITY",
                onClick = {
                    onIntent(WorkoutIntent.LogGeneralActivity(
                        type = type,
                        durationMinutes = duration.toIntOrNull() ?: 0,
                        distanceKm = distance.toDoubleOrNull(),
                        rpe = rpe.toIntOrNull(),
                        notes = notes.takeIf { it.isNotBlank() }
                    ))
                },
                enabled = duration.toIntOrNull() != null,
                isLoading = state.isLogging
            )
        }
    }
}
