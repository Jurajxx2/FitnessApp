package com.coachfoska.app.ui.recipe

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.model.RecipeIngredient
import com.coachfoska.app.domain.model.RecipeStep
import com.coachfoska.app.presentation.recipe.RecipeDetailIntent
import com.coachfoska.app.presentation.recipe.RecipeDetailViewModel
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.app.ui.recipe.components.CookingStepCard
import com.coachfoska.app.ui.recipe.components.ServingsAdjuster
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.log_this_meal
import coachfoska.composeapp.generated.resources.recipe_detail_cook_label
import coachfoska.composeapp.generated.resources.recipe_detail_level_label
import coachfoska.composeapp.generated.resources.recipe_detail_prep_label
import coachfoska.composeapp.generated.resources.recipe_detail_serves_label
import coachfoska.composeapp.generated.resources.recipe_macro_label_carbs
import coachfoska.composeapp.generated.resources.recipe_macro_label_fat
import coachfoska.composeapp.generated.resources.recipe_macro_label_kcal
import coachfoska.composeapp.generated.resources.recipe_macro_label_protein
import coachfoska.composeapp.generated.resources.recipe_no_ingredients
import coachfoska.composeapp.generated.resources.recipe_no_steps
import coachfoska.composeapp.generated.resources.recipe_tab_directions
import coachfoska.composeapp.generated.resources.recipe_tab_ingredients
import coachfoska.composeapp.generated.resources.recipe_title
import coachfoska.composeapp.generated.resources.recipes_add_favorite_cd
import coachfoska.composeapp.generated.resources.recipes_remove_favorite_cd
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun RecipeDetailRoute(
    recipeId: String,
    userId: String,
    onBackClick: () -> Unit,
    onLogMeal: () -> Unit = {},
    viewModel: RecipeDetailViewModel = koinViewModel { parametersOf(recipeId, userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        DsTopBar(
            title = stringResource(Res.string.recipe_title),
            onBackClick = onBackClick,
            backContentDescription = stringResource(Res.string.back_cd),
            actions = {
                IconButton(onClick = { viewModel.onIntent(RecipeDetailIntent.ToggleFavorite) }) {
                    Icon(
                        imageVector = if (state.isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = if (state.isFavorite) stringResource(Res.string.recipes_remove_favorite_cd) else stringResource(Res.string.recipes_add_favorite_cd),
                        tint = if (state.isFavorite) DsTheme.colors.error else DsTheme.colors.textPrimary,
                    )
                }
            }
        )
        when {
            state.isLoading -> DsLoadingBox(Modifier.weight(1f))
            state.error != null -> Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Text(state.error!!, style = MaterialTheme.typography.bodyMedium, color = DsTheme.colors.error)
            }
            state.recipe != null -> Column(modifier = Modifier.weight(1f)) {
                RecipeDetailScreen(
                    recipe = state.recipe!!,
                    selectedServings = state.selectedServings,
                    onIntent = viewModel::onIntent,
                    modifier = Modifier.weight(1f),
                )
                DsButton(
                    text = stringResource(Res.string.log_this_meal),
                    onClick = onLogMeal,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipeDetailScreen(
    recipe: Recipe,
    selectedServings: Int,
    onIntent: (RecipeDetailIntent) -> Unit,
    modifier: Modifier = Modifier,
) {
    var tabIndex by remember { mutableStateOf(0) }
    val tabs = listOf(
        stringResource(Res.string.recipe_tab_ingredients),
        stringResource(Res.string.recipe_tab_directions),
    )

    LazyColumn(
        modifier = modifier.background(DsTheme.colors.background),
        contentPadding = PaddingValues(bottom = 40.dp),
    ) {
        if (recipe.imageUrl != null) {
            item("image") {
                AsyncImage(
                    model = recipe.imageUrl,
                    contentDescription = recipe.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(220.dp),
                )
            }
        }
        item("title") {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = recipe.name.uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    color = DsTheme.colors.textPrimary,
                    letterSpacing = 0.5.sp,
                )
                if (recipe.description.isNotBlank()) {
                    Text(
                        text = recipe.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
                    )
                }
            }
        }
        item("meta") { RecipeMetaRow(recipe = recipe) }
        if (recipe.tags.isNotEmpty()) item("tags") { TagsRow(tags = recipe.tags) }
        item("macros") { MacrosBand(recipe = recipe) }
        item("tabs") {
            ScrollableTabRow(
                selectedTabIndex = tabIndex,
                edgePadding = 24.dp,
                containerColor = DsTheme.colors.background,
            ) {
                tabs.forEachIndexed { i, label ->
                    Tab(
                        selected = tabIndex == i,
                        onClick = { tabIndex = i },
                        text = { Text(label) },
                    )
                }
            }
        }

        when (tabIndex) {
            0 -> ingredientsItems(
                recipe = recipe,
                selectedServings = selectedServings,
                onIntent = onIntent,
            )
            else -> directionsItems(steps = recipe.steps)
        }
    }
}

private fun LazyListScope.ingredientsItems(
    recipe: Recipe,
    selectedServings: Int,
    onIntent: (RecipeDetailIntent) -> Unit,
) {
    item("servings-adjuster") {
        ServingsAdjuster(
            servings = selectedServings,
            onServingsChange = { onIntent(RecipeDetailIntent.AdjustRecipeServings(it)) },
        )
    }
    if (recipe.ingredients.isEmpty()) {
        item("ingredients-empty") {
            Text(
                text = stringResource(Res.string.recipe_no_ingredients),
                modifier = Modifier.padding(24.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
            )
        }
    } else {
        items(items = recipe.ingredients, key = { "ing-${it.name}" }) { ingredient ->
            IngredientRow(ingredient = ingredient)
        }
    }
}

private fun LazyListScope.directionsItems(
    steps: List<RecipeStep>,
) {
    if (steps.isEmpty()) {
        item("steps-empty") {
            Text(
                text = stringResource(Res.string.recipe_no_steps),
                modifier = Modifier.padding(24.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
            )
        }
    } else {
        items(items = steps, key = { "step-${it.id.ifBlank { it.stepNumber.toString() }}" }) { step ->
            CookingStepCard(
                stepNumber = step.stepNumber,
                instruction = step.instruction,
            )
        }
    }
}

@Composable
private fun RecipeMetaRow(recipe: Recipe) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        recipe.prepTimeMinutes?.let {
            MetaChip(label = stringResource(Res.string.recipe_detail_prep_label), value = "${it}m")
        }
        recipe.cookTimeMinutes?.let {
            MetaChip(label = stringResource(Res.string.recipe_detail_cook_label), value = "${it}m")
        }
        if (recipe.servings > 0) {
            MetaChip(label = stringResource(Res.string.recipe_detail_serves_label), value = "${recipe.servings}")
        }
        recipe.difficulty?.let {
            MetaChip(label = stringResource(Res.string.recipe_detail_level_label), value = it.uppercase())
        }
    }
}

@Composable
private fun MetaChip(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = DsTheme.colors.textPrimary,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun TagsRow(tags: List<String>) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        tags.forEach { tag ->
            Surface(
                shape = RoundedCornerShape(50),
                color = DsTheme.colors.textPrimary.copy(alpha = 0.07f)
            ) {
                Text(
                    text = tag,
                    style = MaterialTheme.typography.labelSmall,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun MacrosBand(recipe: Recipe) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
            .background(
                DsTheme.colors.textPrimary.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        MacroItem(value = "${recipe.calories.toInt()}", label = stringResource(Res.string.recipe_macro_label_kcal))
        MacroItem(value = "${recipe.protein.toInt()}g", label = stringResource(Res.string.recipe_macro_label_protein))
        MacroItem(value = "${recipe.carbs.toInt()}g", label = stringResource(Res.string.recipe_macro_label_carbs))
        MacroItem(value = "${recipe.fat.toInt()}g", label = stringResource(Res.string.recipe_macro_label_fat))
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            color = DsTheme.colors.textPrimary,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun IngredientRow(ingredient: RecipeIngredient) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = ingredient.name,
            style = MaterialTheme.typography.bodyMedium,
            color = DsTheme.colors.textPrimary,
            modifier = Modifier.weight(1f)
        )
        val qty = buildString {
            ingredient.quantity?.let { append(if (it == it.toLong().toFloat()) it.toLong().toString() else it.toString()) }
            ingredient.unit?.let { if (it.isNotBlank()) append(" $it") }
        }
        if (qty.isNotBlank()) {
            Text(
                text = qty,
                style = MaterialTheme.typography.bodySmall,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.5f)
            )
        }
    }
}
