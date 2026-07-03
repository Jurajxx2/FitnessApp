package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.SearchOff
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.recipes_add_favorite_cd
import coachfoska.composeapp.generated.resources.recipes_count
import coachfoska.composeapp.generated.resources.recipes_empty_message
import coachfoska.composeapp.generated.resources.recipes_empty_title
import coachfoska.composeapp.generated.resources.recipes_fallback_description
import coachfoska.composeapp.generated.resources.recipes_favorites_filter
import coachfoska.composeapp.generated.resources.recipes_remove_favorite_cd
import coachfoska.composeapp.generated.resources.recipes_search_label
import coachfoska.composeapp.generated.resources.recipes_title
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.app.ui.components.EmptyState
import com.coachfoska.app.ui.components.FoskaFilterChip
import com.coachfoska.app.ui.components.ShimmerBox
import com.coachfoska.app.theme.Spacing
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun RecipesListRoute(
    userId: String,
    onRecipeClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }
    RecipesListScreen(
        state = state,
        onRecipeClick = onRecipeClick,
        onBackClick = onBackClick,
        onToggleFavorite = { viewModel.onIntent(NutritionIntent.ToggleFavoriteRecipe(it)) },
        onToggleFavoritesFilter = { viewModel.onIntent(NutritionIntent.ToggleFavoritesFilter) },
    )
}

@Composable
fun RecipesListScreen(
    state: NutritionState,
    onRecipeClick: (String) -> Unit,
    onBackClick: () -> Unit,
    onToggleFavorite: (String) -> Unit = {},
    onToggleFavoritesFilter: () -> Unit = {},
) {
    var query by remember { mutableStateOf("") }
    var selectedTag by remember { mutableStateOf<String?>(null) }
    val tags = remember(state.recipes) {
        state.recipes.flatMap { it.tags }.distinct().sorted()
    }
    val filteredRecipes = remember(state.recipes, query, selectedTag) {
        val term = query.trim()
        state.recipes
            .filter { recipe -> selectedTag == null || selectedTag in recipe.tags }
            .let { recipes ->
                if (term.isBlank()) recipes else recipes.filter { recipe ->
                recipe.name.contains(term, ignoreCase = true) ||
                    recipe.description.contains(term, ignoreCase = true) ||
                    recipe.tags.any { it.contains(term, ignoreCase = true) }
                }
            }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = stringResource(Res.string.recipes_title), onBackClick = onBackClick)

        Column(
            modifier = Modifier.padding(horizontal = Spacing.xl, vertical = Spacing.sm),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text(stringResource(Res.string.recipes_search_label)) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                shape = RoundedCornerShape(8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = MaterialTheme.colorScheme.onBackground,
                    unfocusedTextColor = MaterialTheme.colorScheme.onBackground,
                    focusedBorderColor = MaterialTheme.colorScheme.onBackground,
                    unfocusedBorderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.12f),
                    focusedLabelColor = MaterialTheme.colorScheme.onBackground,
                    unfocusedLabelColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    cursorColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                FoskaFilterChip(
                    selected = state.showOnlyFavorites,
                    onClick = onToggleFavoritesFilter,
                    label = stringResource(Res.string.recipes_favorites_filter),
                    leadingIcon = if (state.showOnlyFavorites) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                )
                AssistChip(
                    onClick = {},
                    label = { Text(stringResource(Res.string.recipes_count, filteredRecipes.size)) },
                    enabled = false,
                )
            }
            if (tags.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    items(tags.size) { index ->
                        val tag = tags[index]
                        FoskaFilterChip(
                            selected = selectedTag == tag,
                            label = tag,
                            onClick = { selectedTag = if (selectedTag == tag) null else tag },
                        )
                    }
                }
            }
        }

        if (state.isRecipesLoading) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(horizontal = Spacing.xl, vertical = Spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                items(4) {
                    ShimmerBox(Modifier.fillMaxWidth().height(160.dp))
                }
            }
        } else if (filteredRecipes.isEmpty()) {
            EmptyState(
                icon = Icons.Outlined.SearchOff,
                title = stringResource(Res.string.recipes_empty_title),
                message = stringResource(Res.string.recipes_empty_message),
                modifier = Modifier.padding(top = Spacing.xl),
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(horizontal = Spacing.xl, vertical = Spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalArrangement = Arrangement.spacedBy(Spacing.md)
            ) {
                items(filteredRecipes, key = { it.id }) { recipe ->
                    RecipesListCard(
                        recipe = recipe,
                        isFavorite = recipe.id in state.favoriteRecipeIds,
                        onClick = { onRecipeClick(recipe.id) },
                        onToggleFavorite = { onToggleFavorite(recipe.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun RecipesListCard(
    recipe: Recipe,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onToggleFavorite: () -> Unit,
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, end = 4.dp, top = 12.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    text = recipe.name,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onToggleFavorite, modifier = Modifier.size(32.dp)) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = if (isFavorite) {
                            stringResource(Res.string.recipes_remove_favorite_cd)
                        } else {
                            stringResource(Res.string.recipes_add_favorite_cd)
                        },
                        tint = if (isFavorite) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
            Text(
                text = recipe.description.ifBlank { recipe.tags.joinToString(" + ") }
                    .ifBlank { stringResource(Res.string.recipes_fallback_description) },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(end = 12.dp),
            )
            Row(
                modifier = Modifier.padding(end = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                RecipeMacroChip("${recipe.calories.toInt()} kcal")
                RecipeMacroChip("P ${recipe.protein.toInt()}g")
            }
            val timeText = listOfNotNull(
                recipe.prepTimeMinutes?.let { "Prep ${it}m" },
                recipe.cookTimeMinutes?.let { "Cook ${it}m" },
                recipe.difficulty?.replaceFirstChar { it.uppercase() },
            ).joinToString(" + ")
            if (timeText.isNotBlank()) {
                Text(
                    text = timeText,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.42f),
                    modifier = Modifier.padding(end = 12.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun RecipeMacroChip(text: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}
