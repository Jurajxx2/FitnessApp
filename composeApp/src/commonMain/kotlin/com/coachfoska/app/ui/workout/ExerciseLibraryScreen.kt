package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ExerciseLibraryRoute(
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.onIntent(ExerciseIntent.LoadCategories) }

    ExerciseLibraryScreen(
        categories = state.categories,
        isLoading = state.isCategoriesLoading,
        onCategoryClick = onCategoryClick,
        onBackClick = onBackClick
    )
}

@Composable
fun ExerciseLibraryScreen(
    categories: List<com.coachfoska.app.domain.model.ExerciseCategory>,
    isLoading: Boolean,
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "LIBRARY", onBackClick = onBackClick)

        if (isLoading) {
            CoachLoadingBox()
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(24.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(categories) { category ->
                    Surface(
                        onClick = { onCategoryClick(category.id, category.name) },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.background,
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f)
                        )
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1.2f)
                                .padding(16.dp),
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
}
