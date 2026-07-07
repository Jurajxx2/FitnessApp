package com.coachfoska.app.ui.workout

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_clear_cd
import coachfoska.composeapp.generated.resources.exercise_library_no_exercises
import coachfoska.composeapp.generated.resources.substitute_search_hint
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.usecase.exercise.GetExercisesUseCase.Companion.PAGE_SIZE
import com.coachfoska.app.ui.workout.components.ExerciseSearchRow
import kotlinx.coroutines.delay
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.koinInject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubstituteExerciseSheet(
    currentExerciseId: String?,
    title: String,
    sheetState: SheetState,
    onExerciseSelected: (Exercise) -> Unit,
    onDismiss: () -> Unit,
    exerciseRepository: ExerciseRepository = koinInject(),
) {
    var categories by remember { mutableStateOf<List<ExerciseCategory>>(emptyList()) }
    var selectedCategoryId by remember(currentExerciseId) { mutableStateOf<Int?>(null) }
    var searchText by remember { mutableStateOf("") }
    var debouncedQuery by remember { mutableStateOf("") }
    var exercises by remember { mutableStateOf<List<Exercise>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var isLoadingMore by remember { mutableStateOf(false) }
    var hasMore by remember { mutableStateOf(true) }
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) {
        exerciseRepository.getCategories().onSuccess { categories = it }
    }

    LaunchedEffect(currentExerciseId) {
        if (currentExerciseId == null) return@LaunchedEffect
        exerciseRepository.getExerciseById(currentExerciseId).onSuccess { exercise ->
            selectedCategoryId = exercise.category?.id
        }
    }

    LaunchedEffect(searchText) {
        delay(350)
        debouncedQuery = searchText
    }

    suspend fun loadPage(reset: Boolean) {
        if (!reset && (!hasMore || isLoading || isLoadingMore)) return
        if (reset) {
            isLoading = true
            hasMore = true
        } else {
            isLoadingMore = true
        }
        val offset = if (reset) 0 else exercises.size
        exerciseRepository.getExercises(
            offset = offset,
            limit = PAGE_SIZE,
            categoryId = selectedCategoryId,
            query = debouncedQuery.takeIf { it.isNotBlank() },
        ).onSuccess { result ->
            val filtered = result.filter { it.id != currentExerciseId }
            exercises = if (reset) filtered else exercises + filtered
            hasMore = result.size == PAGE_SIZE
        }.onFailure {
            if (reset) exercises = emptyList()
            hasMore = false
        }
        isLoading = false
        isLoadingMore = false
    }

    LaunchedEffect(selectedCategoryId, debouncedQuery, currentExerciseId) {
        loadPage(reset = true)
        listState.scrollToItem(0)
    }

    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible >= listState.layoutInfo.totalItemsCount - 5
        }
    }
    LaunchedEffect(shouldLoadMore, hasMore, isLoadingMore, isLoading) {
        if (shouldLoadMore && hasMore && !isLoadingMore && !isLoading) {
            loadPage(reset = false)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DsTheme.colors.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f)
                .padding(horizontal = DsTheme.spacing.xl),
        ) {
            Text(
                text = title,
                style = androidx.compose.material3.MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = DsTheme.spacing.md),
            )

            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        stringResource(Res.string.substitute_search_hint),
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                    )
                },
                leadingIcon = {
                    Icon(
                        Icons.Default.Search,
                        contentDescription = null,
                        tint = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                    )
                },
                trailingIcon = {
                    if (searchText.isNotEmpty()) {
                        IconButton(onClick = { searchText = "" }) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = stringResource(Res.string.common_clear_cd),
                                tint = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                            )
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = DsTheme.colors.textPrimary.copy(alpha = 0.3f),
                    unfocusedBorderColor = DsTheme.colors.textPrimary.copy(alpha = 0.15f),
                    focusedTextColor = DsTheme.colors.textPrimary,
                    unfocusedTextColor = DsTheme.colors.textPrimary,
                ),
            )

            LazyRow(
                contentPadding = PaddingValues(vertical = DsTheme.spacing.md),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(categories, key = { it.id }) { category ->
                    FilterChip(
                        selected = selectedCategoryId == category.id,
                        onClick = {
                            selectedCategoryId = if (selectedCategoryId == category.id) null else category.id
                        },
                        label = { Text(category.name, fontSize = 13.sp) },
                    )
                }
            }

            Box(modifier = Modifier.weight(1f)) {
                if (isLoading && exercises.isEmpty()) {
                    Box(Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp))
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(bottom = DsTheme.spacing.xxl),
                    ) {
                        items(exercises, key = { it.id }) { exercise ->
                            ExerciseSearchRow(
                                exercise = exercise,
                                onClick = {
                                    onExerciseSelected(exercise)
                                    onDismiss()
                                },
                            )
                        }
                        if (isLoadingMore) {
                            item(key = "loading_more") {
                                Box(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = DsTheme.spacing.lg),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                                }
                            }
                        }
                        if (exercises.isEmpty() && !isLoading) {
                            item(key = "empty") {
                                Box(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = stringResource(Res.string.exercise_library_no_exercises),
                                        color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                                        fontSize = 14.sp,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(DsTheme.spacing.md))
        }
    }
}
