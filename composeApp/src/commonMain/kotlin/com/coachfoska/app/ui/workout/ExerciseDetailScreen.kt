package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme
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
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.chart_metric_best_volume
import coachfoska.composeapp.generated.resources.chart_metric_est_1rm
import coachfoska.composeapp.generated.resources.chart_metric_heaviest_weight
import coachfoska.composeapp.generated.resources.chart_metric_longest_duration
import coachfoska.composeapp.generated.resources.chart_metric_most_reps
import coachfoska.composeapp.generated.resources.chart_metric_num_reps
import coachfoska.composeapp.generated.resources.chart_metric_total_duration
import coachfoska.composeapp.generated.resources.chart_metric_total_reps
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
import coachfoska.composeapp.generated.resources.exercise_records_longest_duration
import coachfoska.composeapp.generated.resources.exercise_records_most_reps
import coachfoska.composeapp.generated.resources.recipes_add_favorite_cd
import coachfoska.composeapp.generated.resources.recipes_remove_favorite_cd
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.RecordEntry
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.usecase.workout.GetExerciseHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseRecordsUseCase
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsTopBar
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ExerciseDetailRoute(
    userId: String,
    exerciseId: String?,
    exerciseName: String? = null,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(exerciseId, exerciseName) {
        if (!exerciseId.isNullOrBlank()) {
            viewModel.onIntent(ExerciseIntent.SelectExercise(exerciseId))
        } else if (!exerciseName.isNullOrBlank()) {
            viewModel.onIntent(ExerciseIntent.SelectExerciseByName(exerciseName))
        }
    }

    ExerciseDetailScreen(
        state = state,
        userId = userId,
        onBackClick = onBackClick,
        onToggleFavorite = {
            state.selectedExercise?.id?.let { viewModel.onIntent(ExerciseIntent.ToggleFavorite(it)) }
        },
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
        DsTopBar(
            title = stringResource(Res.string.exercise_detail_title),
            onBackClick = onBackClick,
            backContentDescription = stringResource(Res.string.back_cd),
            actions = {
                if (exercise != null) {
                    IconButton(onClick = onToggleFavorite) {
                        Icon(
                            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = if (isFavorite) stringResource(Res.string.recipes_remove_favorite_cd) else stringResource(Res.string.recipes_add_favorite_cd),
                            tint = if (isFavorite) DsTheme.colors.actionPrimary else DsTheme.colors.textPrimary.copy(alpha = 0.5f),
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
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.error)
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
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
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
            2 -> ChartsTab(userId = userId, exerciseName = exercise.name, logType = exercise.logType)
            3 -> RecordsTab(userId = userId, exerciseName = exercise.name, logType = exercise.logType)
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
                            color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
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
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.8f),
                )
            }
        }
    }
}

@Composable
private fun HistoryTab(userId: String, exerciseName: String) {
    val getExerciseHistoryUseCase = koinInject<GetExerciseHistoryUseCase>()
    var history by remember(exerciseName) { mutableStateOf<List<ExerciseLog>>(emptyList()) }
    var isLoading by remember(exerciseName) { mutableStateOf(true) }

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
            Text(stringResource(Res.string.exercise_detail_no_history), style = MaterialTheme.typography.bodyMedium, color = DsTheme.colors.textSecondary)
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
                    exerciseLog.loggedAt?.let { loggedAt ->
                        Text(
                            text = loggedAt.toDisplayDateTime(),
                            style = MaterialTheme.typography.labelSmall,
                            color = DsTheme.colors.textSecondary,
                        )
                    }
                    Text(
                        text = stringResource(Res.string.exercise_detail_sets_completed_format, exerciseLog.setsCompletedCount),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    )
                    if (exerciseLog.summaryLine.isNotBlank()) {
                        Text(
                            text = exerciseLog.summaryLine,
                            style = MaterialTheme.typography.bodySmall,
                            color = DsTheme.colors.textSecondary,
                        )
                    }
                    val volumeKg = exerciseLog.sets
                        .filter { it.completed }
                        .sumOf { set ->
                            ((set.actualWeightKg ?: 0f) * (set.actualReps ?: 0)).toDouble()
                        }
                        .toFloat()
                    if (volumeKg > 0f) {
                        Text(
                            text = "${formatWeightKg(volumeKg)} kg",
                            style = MaterialTheme.typography.bodySmall,
                            color = DsTheme.colors.textSecondary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartsTab(userId: String, exerciseName: String, logType: ExerciseLogType) {
    val getExerciseHistoryUseCase = koinInject<GetExerciseHistoryUseCase>()
    var history by remember(exerciseName) { mutableStateOf<List<ExerciseLog>>(emptyList()) }
    var isLoading by remember(exerciseName) { mutableStateOf(true) }
    val metrics = when (logType) {
        ExerciseLogType.WEIGHT_REPS -> listOf(
            ChartMetric.HeaviestWeight, ChartMetric.Est1Rm, ChartMetric.BestVolume, ChartMetric.NumReps,
        )
        ExerciseLogType.BODYWEIGHT_REPS -> listOf(ChartMetric.MostReps, ChartMetric.TotalReps)
        ExerciseLogType.TIME -> listOf(ChartMetric.LongestDuration, ChartMetric.TotalDuration)
    }
    var selectedMetric by remember(exerciseName, logType) { mutableStateOf(metrics.first()) }
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
            Text(stringResource(Res.string.exercise_detail_no_chart_data), style = MaterialTheme.typography.bodyMedium, color = DsTheme.colors.textSecondary)
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

        // History is date-stamped at repository level. Without that timestamp the old selector
        // merely changed a chip while showing every session in every period.
        val filteredHistory = history
            .filter { it.isWithinPeriod(selectedPeriod) }
            .sortedBy { it.loggedAt }

        val rawPoints = filteredHistory.mapNotNull { log ->
            val completedSets = log.sets.filter { it.completed }
            if (completedSets.isEmpty()) return@mapNotNull null
            val value = when (selectedMetric) {
                ChartMetric.HeaviestWeight -> completedSets.mapNotNull { it.actualWeightKg }.maxOrNull()
                ChartMetric.Est1Rm -> completedSets.mapNotNull { s ->
                    val weight = s.actualWeightKg ?: return@mapNotNull null
                    val reps = s.actualReps ?: return@mapNotNull null
                    if (reps in 1..30) weight * (1f + reps / 30f) else weight
                }.maxOrNull()
                ChartMetric.BestVolume -> completedSets.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }.toFloat().takeIf { it > 0f }
                ChartMetric.NumReps, ChartMetric.MostReps ->
                    completedSets.mapNotNull { it.actualReps?.toFloat() }.maxOrNull()
                ChartMetric.TotalReps -> completedSets.sumOf { it.actualReps ?: 0 }.toFloat().takeIf { it > 0f }
                ChartMetric.LongestDuration -> completedSets
                    .mapNotNull { it.actualDurationSeconds ?: it.actualRestSeconds }
                    .maxOrNull()
                    ?.toFloat()
                ChartMetric.TotalDuration -> completedSets
                    .sumOf { it.actualDurationSeconds ?: it.actualRestSeconds ?: 0 }
                    .toFloat()
                    .takeIf { it > 0f }
            } ?: return@mapNotNull null
            ExerciseChartPoint(value = value)
        }

        var bestSoFar = Float.NEGATIVE_INFINITY
        val dataPoints = rawPoints.map { point ->
            val isPersonalRecord = point.value > bestSoFar
            bestSoFar = maxOf(bestSoFar, point.value)
            point.copy(isPersonalRecord = isPersonalRecord)
        }

        // Simple Canvas line chart with markers for every new best in the selected metric.
        if (dataPoints.isNotEmpty()) {
            val primary = DsTheme.colors.actionPrimary
            val surfaceVariant = DsTheme.colors.surfaceElevated
            val recordColor = DsTheme.colors.warning
            val maxVal = dataPoints.maxOf { it.value }.coerceAtLeast(1f)
            val minVal = dataPoints.minOf { it.value }

            Text(stringResource(selectedMetric.labelRes), style = MaterialTheme.typography.titleSmall)
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
                    dataPoints.forEachIndexed { i, point ->
                        val x = padding + step * i
                        val y = padding + chartH * (1f - (point.value - minVal) / range)
                        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    drawPath(
                        path,
                        color = primary,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.5f),
                    )

                }

                val step = if (dataPoints.size > 1) chartW / (dataPoints.size - 1) else 0f
                dataPoints.forEachIndexed { i, point ->
                    val x = if (dataPoints.size == 1) padding + chartW / 2 else padding + step * i
                    val y = padding + chartH * (1f - (point.value - minVal) / range)
                    val center = androidx.compose.ui.geometry.Offset(x, y)
                    drawCircle(primary, radius = 4f, center = center)
                    if (point.isPersonalRecord) {
                        drawCircle(
                            color = recordColor,
                            radius = 7f,
                            center = center,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f),
                        )
                    }
                }
            }
        } else {
            Text(
                text = stringResource(Res.string.exercise_detail_no_chart_data),
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textSecondary,
            )
        }

        // Metric toggle chips
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            metrics.forEach { metric ->
                FilterChip(
                    selected = metric == selectedMetric,
                    onClick = { selectedMetric = metric },
                    label = { Text(stringResource(metric.labelRes), style = MaterialTheme.typography.labelSmall) },
                )
            }
        }
    }
}

private data class ExerciseChartPoint(
    val value: Float,
    val isPersonalRecord: Boolean = false,
)

/** Chart metrics carry their own localized label so the selection key is decoupled from display text. */
private enum class ChartMetric(val labelRes: StringResource) {
    HeaviestWeight(Res.string.chart_metric_heaviest_weight),
    Est1Rm(Res.string.chart_metric_est_1rm),
    BestVolume(Res.string.chart_metric_best_volume),
    NumReps(Res.string.chart_metric_num_reps),
    MostReps(Res.string.chart_metric_most_reps),
    TotalReps(Res.string.chart_metric_total_reps),
    LongestDuration(Res.string.chart_metric_longest_duration),
    TotalDuration(Res.string.chart_metric_total_duration),
}

private fun ExerciseLog.isWithinPeriod(period: String): Boolean {
    val timestamp = loggedAt?.toEpochMilliseconds() ?: return false
    val days = when (period) {
        "1M" -> 30
        "3M" -> 90
        "6M" -> 180
        "1Y" -> 365
        else -> return true
    }
    val cutoff = currentInstant().toEpochMilliseconds() - days * 24L * 60L * 60L * 1_000L
    return timestamp >= cutoff
}

@Composable
private fun RecordsTab(userId: String, exerciseName: String, logType: ExerciseLogType) {
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
    if (r == null || listOfNotNull(
            r.heaviestWeight,
            r.mostRepsAtWeight,
            r.highestEstimated1RM,
            r.highestVolume,
            r.longestDuration,
        ).isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(stringResource(Res.string.exercise_detail_no_records), style = MaterialTheme.typography.bodyMedium, color = DsTheme.colors.textSecondary)
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
        if (logType == ExerciseLogType.WEIGHT_REPS) {
            r.heaviestWeight?.let { RecordCard(stringResource(Res.string.exercise_records_heaviest), it) }
            r.highestEstimated1RM?.let { RecordCard(stringResource(Res.string.exercise_records_est_1rm), it) }
            r.highestVolume?.let { RecordCard(stringResource(Res.string.exercise_records_highest_volume), it) }
        }
        if (logType != ExerciseLogType.TIME) {
            r.mostRepsAtWeight?.let { RecordCard(stringResource(Res.string.exercise_records_most_reps), it) }
        }
        r.longestDuration?.let { RecordCard(stringResource(Res.string.exercise_records_longest_duration), it) }
    }
}

@Composable
private fun RecordCard(title: String, entry: RecordEntry) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = DsTheme.colors.actionPrimary)
            Text(entry.value, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
            Text(entry.detail, style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
            Text(entry.date.toString(), style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
        }
    }
}

@Composable
private fun InfoSection(title: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            title,
            style = MaterialTheme.typography.labelMedium,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
            letterSpacing = 1.5.sp,
        )
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = DsTheme.colors.surfaceElevated.copy(alpha = 0.2f),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(modifier = Modifier.padding(20.dp)) { content() }
        }
    }
}
