package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.exercise_tab_completed_cd
import com.coachfoska.app.presentation.workout.ExerciseDraft
import org.jetbrains.compose.resources.stringResource

@Composable
fun ExerciseTabStrip(
    exercises: List<ExerciseDraft>,
    currentIndex: Int,
    onExerciseSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()

    LaunchedEffect(currentIndex) {
        listState.animateScrollToItem(currentIndex)
    }

    LazyRow(
        state = listState,
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
    ) {
        itemsIndexed(exercises) { index, exercise ->
            val isSelected = index == currentIndex
            val isCompleted = exercise.sets.all { it.completed }

            FilterChip(
                selected = isSelected,
                onClick = { onExerciseSelected(index) },
                label = { Text(exercise.exerciseName, maxLines = 1) },
                leadingIcon = if (isCompleted) {
                    { Icon(Icons.Default.Check, contentDescription = stringResource(Res.string.exercise_tab_completed_cd), modifier = Modifier) }
                } else null,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                    selectedLeadingIconColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        }
    }
}
