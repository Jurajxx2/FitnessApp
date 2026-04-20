package com.coachfoska.app.ui.recipe

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.coachfoska.app.presentation.recipe.RecipeDetailViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun RecipeDetailRoute(
    recipeId: String,
    onBackClick: () -> Unit,
    viewModel: RecipeDetailViewModel = koinViewModel { parametersOf(recipeId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "RECIPE", onBackClick = onBackClick)
        when {
            state.isLoading -> CoachLoadingBox(Modifier.weight(1f))
            state.error != null -> Box(
                modifier = Modifier.weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = state.error!!,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }
            state.recipe != null -> RecipeDetailScreen(
                recipe = state.recipe!!,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun RecipeDetailScreen(recipe: Recipe, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = 40.dp)
    ) {
        // Photo
        if (recipe.imageUrl != null) {
            item {
                AsyncImage(
                    model = recipe.imageUrl,
                    contentDescription = recipe.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp)
                )
            }
        }

        // Name + description
        item {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = recipe.name.uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 0.5.sp
                )
                if (recipe.description.isNotBlank()) {
                    Text(
                        text = recipe.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                        lineHeight = 22.sp
                    )
                }
            }
        }

        // Meta row: prep time, cook time, servings, difficulty
        item {
            RecipeMetaRow(recipe = recipe)
        }

        // Tags
        if (recipe.tags.isNotEmpty()) {
            item {
                TagsRow(tags = recipe.tags)
            }
        }

        // Macros
        item {
            MacrosBand(recipe = recipe)
        }

        // Ingredients
        if (recipe.ingredients.isNotEmpty()) {
            item {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "INGREDIENTS",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                )
            }
            recipe.ingredients.forEach { ingredient ->
                item(key = ingredient.name) {
                    IngredientRow(ingredient = ingredient)
                }
            }
        }

        // Steps
        if (recipe.steps.isNotEmpty()) {
            item {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "PREPARATION",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
                )
            }
            recipe.steps.forEachIndexed { index, step ->
                item(key = "step-$index") {
                    StepRow(number = index + 1, text = step)
                }
            }
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
            MetaChip(label = "PREP", value = "${it}m")
        }
        recipe.cookTimeMinutes?.let {
            MetaChip(label = "COOK", value = "${it}m")
        }
        if (recipe.servings > 0) {
            MetaChip(label = "SERVES", value = "${recipe.servings}")
        }
        recipe.difficulty?.let {
            MetaChip(label = "LEVEL", value = it.uppercase())
        }
    }
}

@Composable
private fun MetaChip(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground,
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
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.07f)
            ) {
                Text(
                    text = tag,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
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
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        MacroItem(value = "${recipe.calories.toInt()}", label = "kcal")
        MacroItem(value = "${recipe.protein.toInt()}g", label = "protein")
        MacroItem(value = "${recipe.carbs.toInt()}g", label = "carbs")
        MacroItem(value = "${recipe.fat.toInt()}g", label = "fat")
    }
}

@Composable
private fun MacroItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
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
            color = MaterialTheme.colorScheme.onBackground,
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
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun StepRow(number: Int, text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "$number",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
            modifier = Modifier.width(20.dp)
        )
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.85f),
            lineHeight = 22.sp,
            modifier = Modifier.weight(1f)
        )
    }
}
