package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.exercise_detail_no_chart_data
import coachfoska.composeapp.generated.resources.exercise_detail_no_history
import coachfoska.composeapp.generated.resources.exercise_detail_no_records
import coachfoska.composeapp.generated.resources.exercise_detail_primary_muscles
import coachfoska.composeapp.generated.resources.exercise_detail_secondary_muscles
import coachfoska.composeapp.generated.resources.exercise_detail_section_equipment
import coachfoska.composeapp.generated.resources.exercise_detail_section_instructions
import coachfoska.composeapp.generated.resources.exercise_detail_section_muscles
import coachfoska.composeapp.generated.resources.exercise_detail_sets_completed_format
import coachfoska.composeapp.generated.resources.exercise_detail_tab_charts
import coachfoska.composeapp.generated.resources.exercise_detail_tab_guide
import coachfoska.composeapp.generated.resources.exercise_detail_tab_history
import coachfoska.composeapp.generated.resources.exercise_detail_tab_records
import coachfoska.composeapp.generated.resources.exercise_detail_title
import coachfoska.composeapp.generated.resources.exercise_records_est_1rm
import coachfoska.composeapp.generated.resources.exercise_records_heaviest
import coachfoska.composeapp.generated.resources.exercise_records_highest_volume
import coachfoska.composeapp.generated.resources.exercise_records_most_reps
import coachfoska.composeapp.generated.resources.recipes_add_favorite_cd
import coachfoska.composeapp.generated.resources.recipes_remove_favorite_cd
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.RecordEntry
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.usecase.workout.GetExerciseHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseRecordsUseCase
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ExerciseDetailRoute(
    userId: String,
    exerciseId: String,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(exerciseId) {
        viewModel.onIntent(ExerciseIntent.SelectExercise(exerciseId))
    }

    ExerciseDetailScreen(
        state = state,
        userId = userId,
        onBackClick = onBackClick,
        onToggleFavorite = { viewModel.onIntent(ExerciseIntent.ToggleFavorite(exerciseId)) },
    )
}

@Composable
fun ExerciseDetailScreen(
    state: ExerciseState,
    userId: String,
    onBackClick: () -> Unit,
    onToggleFavorite: () -> Unit = {},
) {
    val isFavorite = state.selectedExercise?.id?.let { it in state.favoriteIds } ?: false
    val exercise = state.selectedExercise

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(
            title = stringResource(Res.string.exercise_detail_title),
            onBackClick = onBackClick,
            actions = {
                if (exercise != null) {
                    IconButton(onClick = onToggleFavorite) {
                        Icon(
                            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = if (isFavorite) stringResource(Res.string.recipes_remove_favorite_cd) else stringResource(Res.string.recipes_add_favorite_cd),
                            tint = if (isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        )
                    }
                }
            },
        )

        if (state.isLoadingDetail) {
            DsLoadingBox(Modifier.weight(1f))
            return@Column
        }

        if (exercise == null) {
            state.error?.let {
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
            return@Column
        }

        // Exercise name header
        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
            exercise.category?.let {
                Text(
                    text = it.name.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp,
                )
            }
            Text(
                text = exercise.name,
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            )
        }

        // Tab row
        var selectedTab by remember { mutableIntStateOf(0) }
        val tabTitles = listOf(
            stringResource(Res.string.exercise_detail_tab_guide),
            stringResource(Res.string.exercise_detail_tab_history),
            stringResource(Res.string.exercise_detail_tab_charts),
            stringResource(Res.string.exercise_detail_tab_records),
        )
        TabRow(selectedTabIndex = selectedTab) {
            tabTitles.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) },
                )
            }
        }

        // Tab content
        when (selectedTab) {
            0 -> GuideTab(exercise = exercise)
            1 -> HistoryTab(userId = userId, exerciseName = exercise.name)
            2 -> ChartsTab(userId = userId, exerciseName = exercise.name)
            3 -> RecordsTab(userId = userId, exerciseName = exercise.name)
        }
    }
}

@Composable
private fun GuideTab(exercise: com.coachfoska.app.domain.model.Exercise) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ExerciseAnimatedImage(
            startUrl = exercise.imageUrl,
            endUrl = exercise.imageUrl2,
            modifier = Modifier.fillMaxWidth(),
        )

        if (exercise.muscles.isNotEmpty() || exercise.musclesSecondary.isNotEmpty()) {
            InfoSection(title = stringResource(Res.string.exercise_detail_section_muscles)) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (exercise.muscles.isNotEmpty()) {
                        Text(stringResource(Res.string.exercise_detail_primary_muscles, exercise.muscles.joinToString(", ")), style = MaterialTheme.typography.bodyLarge)
                    }
                    if (exercise.musclesSecondary.isNotEmpty()) {
                        Text(
                            stringResource(Res.string.exercise_detail_secondary_muscles, exercise.musclesSecondary.joinToString(", ")),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        )
                    }
                }
            }
        }

        if (exercise.equipment.isNotEmpty()) {
            InfoSection(title = stringResource(Res.string.exercise_detail_section_equipment)) {
                Text(exercise.equipment.joinToString(", "), style = MaterialTheme.typography.bodyLarge)
            }
        }

        if (exercise.description.isNotBlank()) {
            InfoSection(title = stringResource(Res.string.exercise_detail_section_instructions)) {
                Text(
                    exercise.description,
                    style = MaterialTheme.typography.bodyLarge.copy(lineHeight = 24.sp),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                )
            }
        }
    }
}

@Composable
private fun HistoryTab(userId: String, exerciseName: String) {
    val getExerciseHistoryUseCase = koinInject<GetExerciseHistoryUseCase>()
    var history by remember { mutableStateOf<List<ExerciseLog>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(exerciseName) {
        isLoading = true
        getExerciseHistoryUseCase(userId, exerciseName).onSuccess { history = it }
        isLoading = false
    }

    if (isLoading) {
        DsLoadingBox(Modifier.fillMaxSize())
        return
    }

    if (history.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(stringResource(Res.string.exercise_detail_no_history), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        history.forEach { exerciseLog ->
            Card(shape = RoundedCornerShape(8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = stringResource(Res.string.exercise_detail_sets_completed_format, exerciseLog.setsCompletedCount),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    )
                    if (exerciseLog.summaryLine.isNotBlank()) {
                        Text(
                            text = exerciseLog.summaryLine,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartsTab(userId: String, exerciseName: String) {
    val getExerciseHistoryUseCase = koinInject<GetExerciseHistoryUseCase>()
    var history by remember { mutableStateOf<List<ExerciseLog>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedMetric by remember { mutableStateOf("Heaviest Weight") }
    var selectedPeriod by remember { mutableStateOf("3M") }

    LaunchedEffect(exerciseName) {
        isLoading = true
        getExerciseHistoryUseCase(userId, exerciseName).onSuccess { history = it }
        isLoading = false
    }

    if (isLoading) {
        DsLoadingBox(Modifier.fillMaxSize())
        return
    }

    if (history.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(stringResource(Res.string.exercise_detail_no_chart_data), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Time filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("1M", "3M", "6M", "1Y", "All").forEach { period ->
                FilterChip(
                    selected = period == selectedPeriod,
                    onClick = { selectedPeriod = period },
                    label = { Text(period) },
                )
            }
        }

        // Data points: extract metric per session
        val dataPoints = history.mapNotNull { log ->
            val completedSets = log.sets.filter { it.completed }
            if (completedSets.isEmpty()) return@mapNotNull null
            when (selectedMetric) {
                "Heaviest Weight" -> completedSets.maxOfOrNull { it.actualWeightKg ?: 0f }
                "Est. 1RM" -> completedSets.maxOfOrNull { s ->
                    val w = s.actualWeightKg ?: return@maxOfOrNull 0f
                    val r = s.actualReps ?: return@maxOfOrNull 0f
                    if (r in 1..30) w * (1f + r / 30f) else w
                }
                "Best Volume" -> completedSets.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }.toFloat()
                else -> completedSets.maxOfOrNull { (it.actualReps ?: 0).toFloat() }
            } ?: 0f
        }

        // Simple Canvas line chart
        if (dataPoints.isNotEmpty()) {
            val primary = MaterialTheme.colorScheme.primary
            val surfaceVariant = MaterialTheme.colorScheme.surfaceVariant
            val maxVal = dataPoints.max().coerceAtLeast(1f)
            val minVal = dataPoints.min()

            Text(selectedMetric, style = MaterialTheme.typography.titleSmall)
            androidx.compose.foundation.Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp),
            ) {
                val w = size.width
                val h = size.height
                val padding = 8f
                val chartW = w - padding * 2
                val chartH = h - padding * 2
                val range = (maxVal - minVal).coerceAtLeast(1f)

                // Grid lines
                for (i in 0..3) {
                    val y = padding + chartH * (i / 3f)
                    drawLine(
                        surfaceVariant,
                        start = androidx.compose.ui.geometry.Offset(padding, y),
                        end = androidx.compose.ui.geometry.Offset(w - padding, y),
                        strokeWidth = 1f,
                    )
                }

                // Line
                if (dataPoints.size > 1) {
                    val step = chartW / (dataPoints.size - 1)
                    val path = androidx.compose.ui.graphics.Path()
                    dataPoints.forEachIndexed { i, value ->
                        val x = padding + step * i
                        val y = padding + chartH * (1f - (value - minVal) / range)
                        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    drawPath(
                        path,
                        color = primary,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.5f),
                    )

                    // Dots
                    dataPoints.forEachIndexed { i, value ->
                        val x = padding + step * i
                        val y = padding + chartH * (1f - (value - minVal) / range)
                        drawCircle(primary, radius = 4f, center = androidx.compose.ui.geometry.Offset(x, y))
                    }
                }
            }
        }

        // Metric toggle chips
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Heaviest Weight", "Est. 1RM", "Best Volume", "# of Reps").forEach { metric ->
                FilterChip(
                    selected = metric == selectedMetric,
                    onClick = { selectedMetric = metric },
                    label = { Text(metric, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }
    }
}

@Composable
private fun RecordsTab(userId: String, exerciseName: String) {
    val getExerciseRecordsUseCase = koinInject<GetExerciseRecordsUseCase>()
    var records by remember { mutableStateOf<ExerciseRecords?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(exerciseName) {
        isLoading = true
        getExerciseRecordsUseCase(userId, exerciseName).onSuccess { records = it }
        isLoading = false
    }

    if (isLoading) {
        DsLoadingBox(Modifier.fillMaxSize())
        return
    }

    val r = records
    if (r == null || listOfNotNull(r.heaviestWeight, r.mostRepsAtWeight, r.highestEstimated1RM, r.highestVolume).isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(stringResource(Res.string.exercise_detail_no_records), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        r.heaviestWeight?.let { RecordCard(stringResource(Res.string.exercise_records_heaviest), it) }
        r.mostRepsAtWeight?.let { RecordCard(stringResource(Res.string.exercise_records_most_reps), it) }
        r.highestEstimated1RM?.let { RecordCard(stringResource(Res.string.exercise_records_est_1rm), it) }
        r.highestVolume?.let { RecordCard(stringResource(Res.string.exercise_records_highest_volume), it) }
    }
}

@Composable
private fun RecordCard(title: String, entry: RecordEntry) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(entry.value, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
            Text(entry.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(entry.date.toString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun InfoSection(title: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            title,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.5.sp,
        )
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(modifier = Modifier.padding(20.dp)) { content() }
        }
    }
}
