package com.coachfoska.app.ui.workout.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.editor_picker_no_results
import coachfoska.composeapp.generated.resources.editor_picker_search_prompt
import coachfoska.composeapp.generated.resources.substitute_search_hint
import com.coachfoska.app.domain.model.Exercise
import org.jetbrains.compose.resources.stringResource

/**
 * Shared search list composable used in both [ExercisePickerSheet] (Task 7)
 * and [SubstituteExerciseSheet] (Task 8).
 *
 * Renders the search field + loading / results / empty-prompt states.
 * Callers manage [query] and [onQueryChange]; this composable is purely stateless.
 *
 * @param placeholderRes override the placeholder string resource (defaults to substitute_search_hint)
 */
@Composable
fun ExerciseSearchList(
    query: String,
    onQueryChange: (String) -> Unit,
    isSearching: Boolean,
    searchResults: List<Exercise>,
    onExerciseClick: (Exercise) -> Unit,
    modifier: Modifier = Modifier,
    placeholderText: String = stringResource(Res.string.substitute_search_hint),
) {
    Column(modifier = modifier) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = {
                Text(
                    placeholderText,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.4f)
                )
            },
            leadingIcon = {
                Icon(
                    Icons.Default.Search,
                    contentDescription = null,
                    tint = DsTheme.colors.textPrimary.copy(alpha = 0.5f)
                )
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            shape = RoundedCornerShape(8.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = DsTheme.colors.textPrimary.copy(alpha = 0.3f),
                unfocusedBorderColor = DsTheme.colors.textPrimary.copy(alpha = 0.15f),
                focusedTextColor = DsTheme.colors.textPrimary,
                unfocusedTextColor = DsTheme.colors.textPrimary,
            )
        )

        Spacer(modifier = Modifier.height(DsTheme.spacing.md))

        when {
            isSearching -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(28.dp),
                        color = DsTheme.colors.actionPrimary,
                        strokeWidth = 2.dp
                    )
                }
            }
            searchResults.isNotEmpty() -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false),
                    verticalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    items(searchResults, key = { it.id }) { exercise ->
                        ExerciseSearchRow(
                            exercise = exercise,
                            onClick = { onExerciseClick(exercise) }
                        )
                        HorizontalDivider(
                            color = DsTheme.colors.textPrimary.copy(alpha = 0.06f)
                        )
                    }
                }
            }
            query.isBlank() -> {
                Text(
                    text = stringResource(Res.string.editor_picker_search_prompt),
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = DsTheme.spacing.xl)
                )
            }
            else -> {
                Text(
                    text = stringResource(Res.string.editor_picker_no_results),
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = DsTheme.spacing.xl)
                )
            }
        }
    }
}

@Composable
fun ExerciseSearchRow(
    exercise: Exercise,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = DsTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (exercise.imageUrl != null) {
            AsyncImage(
                model = exercise.imageUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(6.dp)),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.width(DsTheme.spacing.md))
        } else {
            Spacer(modifier = Modifier.width(DsTheme.spacing.xxl))
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = exercise.name,
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textPrimary
            )
            val subtitle = exercise.muscles.firstOrNull() ?: exercise.category?.name
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.5f)
                )
            }
        }
    }
}
