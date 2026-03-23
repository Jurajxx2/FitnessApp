package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ExerciseDetailRoute(
    exerciseId: Int,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(exerciseId) {
        viewModel.onIntent(ExerciseIntent.SelectExercise(exerciseId))
    }

    ExerciseDetailScreen(state = state, onBackClick = onBackClick)
}

@Composable
fun ExerciseDetailScreen(
    state: ExerciseState,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = state.selectedExercise?.name ?: "Exercise", onBackClick = onBackClick)

        if (state.isLoadingDetail) {
            CoachLoadingBox()
        } else {
            state.selectedExercise?.let { exercise ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    exercise.category?.let {
                        CoachSectionHeader(text = it.name.uppercase())
                    }
                    if (exercise.muscles.isNotEmpty()) {
                        InfoSection(title = "PRIMARY MUSCLES") {
                            Text(
                                text = exercise.muscles.joinToString(", ") { it.name },
                                color = MaterialTheme.colorScheme.onBackground,
                                fontSize = 14.sp
                            )
                        }
                    }
                    if (exercise.musclesSecondary.isNotEmpty()) {
                        InfoSection(title = "SECONDARY MUSCLES") {
                            Text(
                                text = exercise.musclesSecondary.joinToString(", ") { it.name },
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                                fontSize = 14.sp
                            )
                        }
                    }
                    if (exercise.equipment.isNotEmpty()) {
                        InfoSection(title = "EQUIPMENT") {
                            Text(
                                text = exercise.equipment.joinToString(", ") { it.name },
                                color = MaterialTheme.colorScheme.onBackground,
                                fontSize = 14.sp
                            )
                        }
                    }
                    if (exercise.description.isNotBlank()) {
                        InfoSection(title = "DESCRIPTION") {
                            Text(
                                text = exercise.description,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                                fontSize = 14.sp,
                                lineHeight = 22.sp
                            )
                        }
                    }
                }
            } ?: state.error?.let {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(text = it, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun InfoSection(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(8.dp)
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CoachSectionHeader(text = title)
        content()
    }
}
