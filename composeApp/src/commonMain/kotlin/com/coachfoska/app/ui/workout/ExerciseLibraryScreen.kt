package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_clear_cd
import coachfoska.composeapp.generated.resources.exercise_library_favorites_filter
import coachfoska.composeapp.generated.resources.exercise_library_no_exercises
import coachfoska.composeapp.generated.resources.exercise_library_no_favorites
import coachfoska.composeapp.generated.resources.exercise_library_search_placeholder
import coachfoska.composeapp.generated.resources.exercise_library_title
import coachfoska.composeapp.generated.resources.recipes_add_favorite_cd
import coachfoska.composeapp.generated.resources.recipes_remove_favorite_cd
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseSortOrder
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import kotlinx.coroutines.delay
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val DIFFICULTIES = listOf("Beginner", "Intermediate", "Advanced")

@Composable
fun ExerciseLibraryRoute(
    userId: String,
    onExerciseClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ExerciseLibraryScreen(
        state = state,
        onExerciseClick = onExerciseClick,
        onBackClick = onBackClick,
        onIntent = viewModel::onIntent
    )
}

@Composable
fun ExerciseLibraryScreen(
    state: ExerciseState,
    onExerciseClick: (String) -> Unit,
    onBackClick: () -> Unit,
    onIntent: (ExerciseIntent) -> Unit
) {
    var searchText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(searchText) {
        delay(400)
        onIntent(ExerciseIntent.SearchQueryChanged(searchText))
    }

    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible >= listState.layoutInfo.totalItemsCount - 5
        }
    }
    LaunchedEffect(shouldLoadMore, state.hasMore, state.isLoadingMore) {
        if (shouldLoadMore && state.hasMore && !state.isLoadingMore && !state.isLoadingExercises) {
            onIntent(ExerciseIntent.LoadMoreExercises)
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = stringResource(Res.string.exercise_library_title), onBackClick = onBackClick)

        OutlinedTextField(
            value = searchText,
            onValueChange = { searchText = it },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(top = 16.dp, bottom = 4.dp),
            placeholder = {
                Text(
                    stringResource(Res.string.exercise_library_search_placeholder),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    fontSize = 14.sp
                )
            },
            leadingIcon = {
                Icon(
                    Icons.Default.Search,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
            },
            trailingIcon = {
                if (searchText.isNotEmpty()) {
                    IconButton(onClick = { searchText = "" }) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = stringResource(Res.string.common_clear_cd),
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                        )
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                unfocusedBorderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f),
                focusedTextColor = MaterialTheme.colorScheme.onBackground,
                unfocusedTextColor = MaterialTheme.colorScheme.onBackground
            )
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                FilterChip(
                    selected = state.showOnlyFavorites,
                    onClick = { onIntent(ExerciseIntent.ToggleFavoritesFilter) },
                    leadingIcon = {
                        Icon(
                            imageVector = if (state.showOnlyFavorites) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    label = { Text(stringResource(Res.string.exercise_library_favorites_filter), fontSize = 13.sp) }
                )
            }
            items(state.categories, key = { it.id }) { category ->
                FilterChip(
                    selected = state.selectedCategoryId == category.id,
                    onClick = { onIntent(ExerciseIntent.SelectCategoryFilter(category.id)) },
                    label = { Text(category.name, fontSize = 13.sp) }
                )
            }
            items(DIFFICULTIES) { difficulty ->
                FilterChip(
                    selected = state.selectedDifficulty == difficulty,
                    onClick = { onIntent(ExerciseIntent.SelectDifficultyFilter(difficulty)) },
                    label = { Text(difficulty, fontSize = 13.sp) }
                )
            }
            item {
                FilterChip(
                    selected = state.sortOrder == ExerciseSortOrder.NAME_DESC,
                    onClick = {
                        onIntent(
                            ExerciseIntent.SelectSortOrder(
                                if (state.sortOrder == ExerciseSortOrder.NAME_ASC) ExerciseSortOrder.NAME_DESC
                                else ExerciseSortOrder.NAME_ASC
                            )
                        )
                    },
                    label = {
                        Text(
                            if (state.sortOrder == ExerciseSortOrder.NAME_ASC) "A→Z" else "Z→A",
                            fontSize = 13.sp
                        )
                    }
                )
            }
        }

        Box(modifier = Modifier.weight(1f)) {
            if (state.isLoadingExercises && state.exercises.isEmpty()) {
                DsLoadingBox()
            } else {
                LazyColumn(
                    state = listState,
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(state.exercises, key = { it.id }) { exercise ->
                        ExerciseListItem(
                            exercise = exercise,
                            isFavorite = exercise.id in state.favoriteIds,
                            onToggleFavorite = { onIntent(ExerciseIntent.ToggleFavorite(exercise.id)) },
                            onClick = { onExerciseClick(exercise.id) }
                        )
                    }
                    if (state.isLoadingMore) {
                        item(key = "loading_more") {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                            }
                        }
                    }
                    if (state.exercises.isEmpty() && !state.isLoadingExercises) {
                        item(key = "empty") {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (state.showOnlyFavorites) stringResource(Res.string.exercise_library_no_favorites) else stringResource(Res.string.exercise_library_no_exercises),
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExerciseListItem(
    exercise: Exercise,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (exercise.imageUrl != null) {
            AsyncImage(
                model = exercise.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .width(72.dp)
                    .height(64.dp)
                    .clip(RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f))
            )
        }
        Row(
            modifier = Modifier
                .weight(1f)
                .padding(start = 16.dp, top = 14.dp, bottom = 14.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = exercise.name,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium
                )
                exercise.category?.let { cat ->
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.secondaryContainer,
                    ) {
                        Text(
                            text = cat.name,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
                if (exercise.muscles.isNotEmpty()) {
                    Text(
                        text = exercise.muscles.joinToString(", "),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        fontSize = 12.sp
                    )
                }
            }
            IconButton(onClick = onToggleFavorite) {
                Icon(
                    imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = if (isFavorite) stringResource(Res.string.recipes_remove_favorite_cd) else stringResource(Res.string.recipes_add_favorite_cd),
                    tint = if (isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
