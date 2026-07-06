package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.editor_add_exercise
import coachfoska.composeapp.generated.resources.editor_day_label
import coachfoska.composeapp.generated.resources.editor_exercises_error
import coachfoska.composeapp.generated.resources.editor_move_down_cd
import coachfoska.composeapp.generated.resources.editor_move_up_cd
import coachfoska.composeapp.generated.resources.editor_name_error
import coachfoska.composeapp.generated.resources.editor_name_label
import coachfoska.composeapp.generated.resources.editor_remove_cd
import coachfoska.composeapp.generated.resources.editor_reps
import coachfoska.composeapp.generated.resources.editor_rest
import coachfoska.composeapp.generated.resources.editor_save
import coachfoska.composeapp.generated.resources.editor_sets
import coachfoska.composeapp.generated.resources.editor_title_edit
import coachfoska.composeapp.generated.resources.editor_title_new
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.presentation.workout.EditorExercise
import com.coachfoska.app.presentation.workout.WorkoutEditorIntent
import com.coachfoska.app.presentation.workout.WorkoutEditorState
import com.coachfoska.app.presentation.workout.WorkoutEditorViewModel
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.theme.Sizes
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.designsystem.components.DsChip
import com.coachfoska.app.ui.components.localizedShortName
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val DAY_ORDER = DayOfWeek.entries.sortedBy { it.index }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutEditorRoute(
    userId: String,
    workoutId: String?,
    onDone: () -> Unit,
    viewModel: WorkoutEditorViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // Trigger load once on composition
    LaunchedEffect(workoutId) {
        viewModel.onIntent(WorkoutEditorIntent.Load(workoutId))
    }

    // Navigate away once saved
    LaunchedEffect(state.savedWorkoutId) {
        if (state.savedWorkoutId != null) onDone()
    }

    WorkoutEditorScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onDone,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutEditorScreen(
    state: WorkoutEditorState,
    onIntent: (WorkoutEditorIntent) -> Unit,
    onBackClick: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var showPicker by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    // Show error in snackbar
    LaunchedEffect(state.error) {
        if (state.error != null) {
            snackbarHostState.showSnackbar(state.error)
            onIntent(WorkoutEditorIntent.DismissError)
        }
    }

    Scaffold(
        topBar = {
            DsTopBar(
                title = stringResource(
                    if (state.workoutId == null) Res.string.editor_title_new
                    else Res.string.editor_title_edit
                ),
                onBackClick = onBackClick,
                backContentDescription = stringResource(Res.string.back_cd),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.xl, vertical = Spacing.lg)
            ) {
                DsButton(
                    text = stringResource(Res.string.editor_save),
                    onClick = { onIntent(WorkoutEditorIntent.Save) },
                    isLoading = state.isSaving,
                )
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(
                horizontal = Spacing.xl,
                vertical = Spacing.lg
            ),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg)
        ) {
            // ── Name field ────────────────────────────────────────────────────
            item {
                OutlinedTextField(
                    value = state.name,
                    onValueChange = { onIntent(WorkoutEditorIntent.UpdateName(it)) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(Res.string.editor_name_label)) },
                    isError = state.nameError,
                    supportingText = if (state.nameError) {
                        { Text(stringResource(Res.string.editor_name_error)) }
                    } else null,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MaterialTheme.colorScheme.onBackground,
                        unfocusedTextColor = MaterialTheme.colorScheme.onBackground,
                        focusedBorderColor = MaterialTheme.colorScheme.onBackground,
                        unfocusedBorderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
                        errorBorderColor = MaterialTheme.colorScheme.error,
                        errorLabelColor = MaterialTheme.colorScheme.error,
                        errorSupportingTextColor = MaterialTheme.colorScheme.error,
                        cursorColor = MaterialTheme.colorScheme.onBackground,
                        focusedLabelColor = MaterialTheme.colorScheme.onBackground,
                        unfocusedLabelColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    )
                )
            }

            // ── Day-of-week selector ──────────────────────────────────────────
            item {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    Text(
                        text = stringResource(Res.string.editor_day_label),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.sm)
                    ) {
                        items(DAY_ORDER.size) { idx ->
                            val day = DAY_ORDER[idx]
                            DsChip(
                                selected = state.dayOfWeek == day,
                                label = day.localizedShortName().uppercase(),
                                onClick = {
                                    // Tap again to clear
                                    onIntent(WorkoutEditorIntent.UpdateDay(
                                        if (state.dayOfWeek == day) null else day
                                    ))
                                }
                            )
                        }
                    }
                }
            }

            // ── Exercise list ─────────────────────────────────────────────────
            itemsIndexed(state.exercises, key = { idx, _ -> idx }) { index, exercise ->
                ExerciseEditorCard(
                    exercise = exercise,
                    index = index,
                    isFirst = index == 0,
                    isLast = index == state.exercises.lastIndex,
                    onIntent = onIntent,
                )
            }

            // ── Exercises error ───────────────────────────────────────────────
            if (state.exercisesError) {
                item {
                    Text(
                        text = stringResource(Res.string.editor_exercises_error),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            // ── Add exercise button ───────────────────────────────────────────
            item {
                DsButton(
                    text = stringResource(Res.string.editor_add_exercise),
                    onClick = {
                        showPicker = true
                        scope.launch { sheetState.show() }
                    },
                )
            }
        }

        // ── Exercise picker sheet ─────────────────────────────────────────────
        if (showPicker) {
            ExercisePickerSheet(
                state = state,
                sheetState = sheetState,
                onIntent = onIntent,
                onDismiss = {
                    scope.launch { sheetState.hide() }.invokeOnCompletion {
                        showPicker = false
                        // Clear search when closing
                        onIntent(WorkoutEditorIntent.SearchExercises(""))
                    }
                },
            )
        }
    }
}

@Composable
private fun ExerciseEditorCard(
    exercise: EditorExercise,
    index: Int,
    isFirst: Boolean,
    isLast: Boolean,
    onIntent: (WorkoutEditorIntent) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            // Header row: name + reorder + remove
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = exercise.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (exercise.muscleGroup != null) {
                        Text(
                            text = exercise.muscleGroup,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }
                }
                // Up button — 48dp touch target
                IconButton(
                    onClick = { onIntent(WorkoutEditorIntent.MoveExercise(index, -1)) },
                    modifier = Modifier.size(Sizes.touchTarget),
                    enabled = !isFirst,
                ) {
                    Icon(
                        Icons.Default.KeyboardArrowUp,
                        contentDescription = stringResource(Res.string.editor_move_up_cd),
                        tint = if (!isFirst) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
                    )
                }
                // Down button — 48dp touch target
                IconButton(
                    onClick = { onIntent(WorkoutEditorIntent.MoveExercise(index, 1)) },
                    modifier = Modifier.size(Sizes.touchTarget),
                    enabled = !isLast,
                ) {
                    Icon(
                        Icons.Default.KeyboardArrowDown,
                        contentDescription = stringResource(Res.string.editor_move_down_cd),
                        tint = if (!isLast) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
                    )
                }
                // Remove button — 48dp touch target
                IconButton(
                    onClick = { onIntent(WorkoutEditorIntent.RemoveExercise(index)) },
                    modifier = Modifier.size(Sizes.touchTarget),
                ) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = stringResource(Res.string.editor_remove_cd),
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(Spacing.sm))

            // Sets / Reps / Rest inputs row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Sets (numeric)
                ExerciseParamField(
                    value = exercise.sets.toString(),
                    label = stringResource(Res.string.editor_sets),
                    onValueChange = { v ->
                        v.toIntOrNull()?.let { onIntent(WorkoutEditorIntent.UpdateSets(index, it)) }
                    },
                    modifier = Modifier.weight(1f),
                    keyboardType = KeyboardType.Number,
                )
                // Reps (text, e.g. "8-12")
                ExerciseParamField(
                    value = exercise.reps,
                    label = stringResource(Res.string.editor_reps),
                    onValueChange = { onIntent(WorkoutEditorIntent.UpdateReps(index, it)) },
                    modifier = Modifier.weight(1f),
                    keyboardType = KeyboardType.Text,
                )
                // Rest seconds (numeric)
                ExerciseParamField(
                    value = exercise.restSeconds.toString(),
                    label = stringResource(Res.string.editor_rest),
                    onValueChange = { v ->
                        v.toIntOrNull()?.let { onIntent(WorkoutEditorIntent.UpdateRest(index, it)) }
                    },
                    modifier = Modifier.weight(1f),
                    keyboardType = KeyboardType.Number,
                )
            }
        }
    }
}

@Composable
private fun ExerciseParamField(
    value: String,
    label: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = keyboardType,
            imeAction = ImeAction.Next,
        ),
        shape = RoundedCornerShape(6.dp),
        textStyle = MaterialTheme.typography.bodyMedium,
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = MaterialTheme.colorScheme.onSurface,
            unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
            focusedBorderColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            unfocusedBorderColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f),
            focusedLabelColor = MaterialTheme.colorScheme.onSurface,
            unfocusedLabelColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
            cursorColor = MaterialTheme.colorScheme.onSurface,
        )
    )
}
