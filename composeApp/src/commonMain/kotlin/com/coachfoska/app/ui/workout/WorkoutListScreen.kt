package com.coachfoska.app.ui.workout

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachSectionHeader
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutListRoute(
    userId: String,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit,
    onHistoryItemClick: (String) -> Unit,
    workoutViewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
    exerciseViewModel: ExerciseViewModel = koinViewModel()
) {
    val workoutState by workoutViewModel.state.collectAsStateWithLifecycle()
    val exerciseState by exerciseViewModel.state.collectAsStateWithLifecycle()

    WorkoutListScreen(
        workoutState = workoutState,
        exerciseState = exerciseState,
        onWorkoutClick = onWorkoutClick,
        onLogWorkoutClick = onLogWorkoutClick,
        onCategoryClick = onCategoryClick,
        onHistoryItemClick = onHistoryItemClick,
        onLoadHistory = { workoutViewModel.onIntent(WorkoutIntent.LoadHistory) },
        onLoadCategories = { exerciseViewModel.onIntent(ExerciseIntent.LoadCategories) }
    )
}

@Composable
fun WorkoutListScreen(
    workoutState: WorkoutState,
    exerciseState: ExerciseState,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit,
    onHistoryItemClick: (String) -> Unit,
    onLoadHistory: () -> Unit,
    onLoadCategories: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("PLAN", "HISTORY", "LIBRARY")

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Text(
            text = "WORKOUTS",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.background,
            contentColor = MaterialTheme.colorScheme.onBackground,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    height = 2.dp,
                    color = MaterialTheme.colorScheme.onBackground
                )
            },
            divider = {
                HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.labelLarge,
                            color = if (selectedTab == index)
                                MaterialTheme.colorScheme.onBackground
                            else
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                        )
                    }
                )
            }
        }

        AnimatedContent(
            targetState = selectedTab,
            transitionSpec = {
                fadeIn(tween(200)) togetherWith fadeOut(tween(150))
            },
            label = "tab_content",
            modifier = Modifier.weight(1f)
        ) { tab ->
            when (tab) {
                0 -> WorkoutsTab(
                    state = workoutState,
                    onWorkoutClick = onWorkoutClick,
                    onLogWorkoutClick = onLogWorkoutClick
                )
                1 -> HistoryTab(
                    state = workoutState,
                    onLoad = onLoadHistory,
                    onItemClick = onHistoryItemClick
                )
                2 -> ExercisesTab(
                    state = exerciseState,
                    onLoad = onLoadCategories,
                    onCategoryClick = onCategoryClick
                )
            }
        }
    }
}

@Composable
private fun WorkoutsTab(
    state: WorkoutState,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit
) {
    if (state.isLoading) {
        CoachLoadingBox()
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(state.workouts) { workout ->
                WorkoutCard(workout = workout, onClick = { onWorkoutClick(workout.id) })
            }
            if (state.workouts.isEmpty()) {
                item {
                    Text(
                        text = "No workouts assigned yet.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                    )
                }
            }
        }

        CoachButton(
            text = "LOG SESSION",
            onClick = onLogWorkoutClick,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 24.dp)
        )
    }
}

@Composable
private fun WorkoutCard(workout: Workout, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            workout.dayOfWeek?.let {
                Text(
                    text = it.displayName.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
            }
            
            Text(
                text = workout.name,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )
            
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatItem(label = "${workout.exercises.size} Exercises")
                if (workout.durationMinutes > 0) {
                    Box(modifier = Modifier.size(3.dp).background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f), RoundedCornerShape(50)))
                    StatItem(label = "${workout.durationMinutes} Min")
                }
            }
        }
    }
}

@Composable
private fun StatItem(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
    )
}

@Composable
private fun HistoryTab(
    state: WorkoutState,
    onLoad: () -> Unit,
    onItemClick: (String) -> Unit
) {
    LaunchedEffect(Unit) { onLoad() }

    if (state.isHistoryLoading) {
        CoachLoadingBox()
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(state.workoutHistory) { log ->
            HistoryLogCard(log = log, onClick = { onItemClick(log.id) })
        }
        if (state.workoutHistory.isEmpty()) {
            item {
                Text(
                    text = "No sessions logged yet.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                )
            }
        }
    }
}

@Composable
private fun HistoryLogCard(log: WorkoutLog, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = log.workoutName,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = log.loggedAt.toDisplayDateTime(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                )
            }
            Text(
                text = "${log.exerciseLogs.size} exercises recorded",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun ExercisesTab(
    state: ExerciseState,
    onLoad: () -> Unit,
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit
) {
    LaunchedEffect(Unit) { onLoad() }

    if (state.isCategoriesLoading) {
        CoachLoadingBox()
    } else {
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(state.categories) { category ->
                Surface(
                    onClick = { onCategoryClick(category.id, category.name) },
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.background,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f))
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth().aspectRatio(1.2f).padding(16.dp),
                        contentAlignment = Alignment.BottomStart
                    ) {
                        Text(
                            text = category.name.uppercase(),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onBackground,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }
        }
    }
}
