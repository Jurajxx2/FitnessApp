package com.coachfoska.app.ui.workout

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.usecase.workout.deriveCategoryLabel
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.workout.components.AssignedWorkoutCard
import com.coachfoska.app.ui.workout.components.ExercisePreviewCard
import com.coachfoska.app.ui.workout.components.QuickLinkRow
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun ActivityHubRoute(
    userId: String,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onExerciseClick: (exerciseId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
    exerciseViewModel: ExerciseViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val exerciseState by exerciseViewModel.state.collectAsStateWithLifecycle()

    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    ActivityHubScreen(
        state = state,
        exercises = exerciseState.exercises,
        onStartWorkout = onStartWorkout,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onLibraryClick = onLibraryClick,
        onProgressClick = onProgressClick,
        onWorkoutClick = onWorkoutClick,
        onExerciseClick = onExerciseClick,
        onLogGeneralActivityClick = onLogGeneralActivityClick,
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    exercises: List<Exercise>,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onExerciseClick: (exerciseId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    val today = todayDate()
    val todayWorkout = remember(state.workouts, today) {
        state.workouts.firstOrNull { it.dayOfWeek?.index == today.dayOfWeek.ordinal }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            BrandHeader()

            if (state.isLoading && state.workouts.isEmpty()) {
                CoachLoadingBox(modifier = Modifier.fillMaxWidth().height(200.dp))
            } else {
                StartWorkoutButton(todayWorkout = todayWorkout, onStartWorkout = onStartWorkout, onBrowse = onPlanClick)

                if (state.workouts.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SectionHeader(title = "YOUR WORKOUTS", onSeeAll = onPlanClick)
                        WorkoutCardRow(workouts = state.workouts, onWorkoutClick = onWorkoutClick)
                    }
                } else {
                    Text(
                        text = "No workouts assigned yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (state.allWorkouts.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SectionHeader(title = "ALL WORKOUTS", onSeeAll = onPlanClick)
                        WorkoutCardRow(workouts = state.allWorkouts, onWorkoutClick = onWorkoutClick)
                    }
                }

                if (exercises.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SectionHeader(title = "EXERCISES", onSeeAll = onLibraryClick)
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(end = 16.dp),
                        ) {
                            items(exercises, key = { it.id }) { exercise ->
                                ExercisePreviewCard(
                                    exercise = exercise,
                                    onClick = { onExerciseClick(exercise.id) },
                                )
                            }
                        }
                    }
                }

                Column {
                    QuickLinkRow(icon = Icons.Filled.History, label = "WORKOUT HISTORY", onClick = onHistoryClick)
                    QuickLinkRow(icon = Icons.AutoMirrored.Filled.TrendingUp, label = "PROGRESS ANALYTICS", onClick = onProgressClick)
                    QuickLinkRow(icon = Icons.Filled.Add, label = "LOG ACTIVITY", onClick = onLogGeneralActivityClick)
                }

                state.error?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BrandHeader() {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(
            text = "Activity",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun SectionHeader(title: String, onSeeAll: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SectionLabel(title)
        Text(
            text = "SEE ALL",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            letterSpacing = 1.sp,
            modifier = Modifier.clickable(onClick = onSeeAll),
        )
    }
}

@Composable
private fun WorkoutCardRow(workouts: List<Workout>, onWorkoutClick: (String) -> Unit) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(end = 16.dp),
    ) {
        items(workouts, key = { it.id }) { workout ->
            AssignedWorkoutCard(
                workout = workout,
                categoryLabel = deriveCategoryLabel(workout),
                onClick = { onWorkoutClick(workout.id) },
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onBackground,
        letterSpacing = 1.5.sp,
    )
}

@Composable
private fun StartWorkoutButton(
    todayWorkout: Workout?,
    onStartWorkout: (String) -> Unit,
    onBrowse: () -> Unit,
) {
    Button(
        onClick = { if (todayWorkout != null) onStartWorkout(todayWorkout.id) else onBrowse() },
        modifier = Modifier.fillMaxWidth().height(56.dp),
        shape = SquareShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            text = if (todayWorkout != null) "START WORKOUT" else "BROWSE WORKOUTS",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
    }
}

private fun previewExercise(name: String, muscle: String) = WorkoutExercise(
    id = name, workoutId = "1", name = name, muscleGroup = muscle,
    sets = 4, reps = "10", restSeconds = 90, tips = null,
)

@Preview
@Composable
private fun ActivityHubScreenPreview() {
    val workouts = listOf(
        Workout(
            id = "1", name = "Upper Body Strength", dayOfWeek = DayOfWeek.MONDAY, durationMinutes = 45,
            exercises = listOf(previewExercise("Bench", "Chest"), previewExercise("Row", "Back")),
        ),
        Workout(
            id = "2", name = "Leg Day", dayOfWeek = DayOfWeek.FRIDAY, durationMinutes = 60,
            exercises = listOf(previewExercise("Squat", "Legs")),
        ),
    )
    ActivityHubScreen(
        state = WorkoutState(workouts = workouts, allWorkouts = workouts),
        exercises = emptyList(),
        onStartWorkout = {}, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {},
        onExerciseClick = {}, onLogGeneralActivityClick = {},
    )
}

@Preview
@Composable
private fun ActivityHubScreenRestDayPreview() {
    ActivityHubScreen(
        state = WorkoutState(workouts = emptyList()),
        exercises = emptyList(),
        onStartWorkout = {}, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {},
        onExerciseClick = {}, onLogGeneralActivityClick = {},
    )
}
