package com.coachfoska.app.ui.workout

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
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
    onLoadHistory: () -> Unit,
    onLoadCategories: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("WORKOUTS", "HISTORY", "EXERCISES")

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Text(
            text = "WORKOUTS",
            color = MaterialTheme.colorScheme.onBackground,
            style = MaterialTheme.typography.headlineMedium,
            letterSpacing = 2.sp,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 20.dp)
        )

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.background,
            contentColor = MaterialTheme.colorScheme.primary,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    height = 2.dp,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = title,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp,
                            color = if (selectedTab == index)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                        )
                    }
                )
            }
        }

        AnimatedContent(
            targetState = selectedTab,
            transitionSpec = {
                val direction = if (targetState > initialState) 1 else -1
                (slideInHorizontally(tween(250)) { it * direction } + fadeIn(tween(200))) togetherWith
                    (slideOutHorizontally(tween(200)) { -it * direction } + fadeOut(tween(150)))
            },
            label = "tab_content"
        ) { tab ->
            when (tab) {
                0 -> WorkoutsTab(
                    state = workoutState,
                    onWorkoutClick = onWorkoutClick,
                    onLogWorkoutClick = onLogWorkoutClick
                )
                1 -> HistoryTab(state = workoutState, onLoad = onLoadHistory)
                2 -> ExercisesTab(
                    state = exerciseState,
                    onLoad = onLoadCategories,
                    onCategoryClick = onCategoryClick
                )
            }
        }
    }
}

// ── Tab 1: Workouts ───────────────────────────────────────────────────────────

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
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(state.workouts) { workout ->
                WorkoutCard(workout = workout, onClick = { onWorkoutClick(workout.id) })
            }
            if (state.workouts.isEmpty()) {
                item {
                    Text(
                        text = "No workouts assigned yet.\nCheck back after your coach sets up your plan.",
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        fontSize = 14.sp,
                        lineHeight = 22.sp
                    )
                }
            }
        }

        CoachButton(
            text = "LOG WORKOUT",
            onClick = onLogWorkoutClick,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp)
        )
    }

    state.error?.let {
        Text(
            text = it,
            color = MaterialTheme.colorScheme.error,
            fontSize = 13.sp,
            modifier = Modifier.padding(24.dp)
        )
    }
}

@Composable
private fun WorkoutCard(workout: Workout, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        workout.dayOfWeek?.let {
            CoachSectionHeader(text = it.displayName.uppercase())
        }
        Text(
            text = workout.name,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "${workout.exercises.size} exercises",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                fontSize = 13.sp
            )
            if (workout.durationMinutes > 0) {
                Text(
                    text = "${workout.durationMinutes} min",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    fontSize = 13.sp
                )
            }
        }
    }
}

// ── Tab 2: History ────────────────────────────────────────────────────────────

@Composable
private fun HistoryTab(state: WorkoutState, onLoad: () -> Unit) {
    LaunchedEffect(Unit) { onLoad() }

    if (state.isHistoryLoading) {
        CoachLoadingBox()
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(state.workoutHistory) { log ->
            HistoryLogCard(log = log)
        }
        if (state.workoutHistory.isEmpty()) {
            item {
                Text(
                    text = "No workouts logged yet.",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
private fun HistoryLogCard(log: WorkoutLog) {
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .clickable { expanded = !expanded }
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                text = log.workoutName,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = log.loggedAt.toDisplayDateTime(),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                fontSize = 12.sp
            )
        }
        if (log.durationMinutes > 0) {
            Text(
                text = "${log.durationMinutes} min",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                fontSize = 13.sp
            )
        }
        if (expanded) {
            log.exerciseLogs.forEach { exerciseLog ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        text = exerciseLog.exerciseName,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    exerciseLog.weightKg?.let {
                        Text(
                            text = "${it}kg",
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}

// ── Tab 3: Exercise categories ────────────────────────────────────────────────

@Composable
private fun ExercisesTab(
    state: ExerciseState,
    onLoad: () -> Unit,
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit
) {
    LaunchedEffect(Unit) { onLoad() }

    when {
        state.isCategoriesLoading -> CoachLoadingBox()
        state.error != null -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = state.error, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            }
        }
        else -> {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.categories) { category ->
                    CategoryCard(
                        category = category,
                        onClick = { onCategoryClick(category.id, category.name) }
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryCard(category: ExerciseCategory, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1.4f)
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.07f),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        contentAlignment = Alignment.BottomStart
    ) {
        Text(
            text = category.name,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
