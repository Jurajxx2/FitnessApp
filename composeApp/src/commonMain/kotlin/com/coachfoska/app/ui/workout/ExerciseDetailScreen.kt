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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachSectionHeader
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
    if (state.isLoadingDetail) {
        CoachLoadingBox()
    } else {
        state.selectedExercise?.let { exercise ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp)
            ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        exercise.category?.let {
                            Text(
                                text = it.name.uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                                letterSpacing = 1.sp
                            )
                        }
                        Text(
                            text = exercise.name,
                            style = MaterialTheme.typography.displayMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }

                    if (exercise.muscles.isNotEmpty() || exercise.musclesSecondary.isNotEmpty()) {
                        InfoSection(title = "MUSCLES") {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (exercise.muscles.isNotEmpty()) {
                                    Text(
                                        text = "Primary: " + exercise.muscles.joinToString(", ") { it.name },
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = MaterialTheme.colorScheme.onBackground
                                    )
                                }
                                if (exercise.musclesSecondary.isNotEmpty()) {
                                    Text(
                                        text = "Secondary: " + exercise.musclesSecondary.joinToString(", ") { it.name },
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                                    )
                                }
                            }
                        }
                    }

                    if (exercise.equipment.isNotEmpty()) {
                        InfoSection(title = "EQUIPMENT") {
                            Text(
                                text = exercise.equipment.joinToString(", ") { it.name },
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                        }
                    }

                    if (exercise.description.isNotBlank()) {
                        InfoSection(title = "INSTRUCTIONS") {
                            Text(
                                text = exercise.description,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                                lineHeight = 24.sp
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(32.dp))
                }
            } ?: state.error?.let {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        }
}

@Composable
private fun InfoSection(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.5.sp
        )
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(modifier = Modifier.padding(20.dp)) {
                content()
            }
        }
    }
}
