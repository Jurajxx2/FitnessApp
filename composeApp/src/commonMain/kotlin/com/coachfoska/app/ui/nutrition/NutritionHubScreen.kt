package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_see_all
import coachfoska.composeapp.generated.resources.img_nutrition_history
import coachfoska.composeapp.generated.resources.img_nutrition_plan
import coachfoska.composeapp.generated.resources.log_meal_button
import coachfoska.composeapp.generated.resources.nutrition_hub_featured_recipes
import coachfoska.composeapp.generated.resources.nutrition_hub_history_subtitle
import coachfoska.composeapp.generated.resources.nutrition_hub_history_title
import coachfoska.composeapp.generated.resources.nutrition_hub_log_eyebrow
import coachfoska.composeapp.generated.resources.nutrition_hub_no_recipes
import coachfoska.composeapp.generated.resources.nutrition_hub_plan_eyebrow
import coachfoska.composeapp.generated.resources.nutrition_hub_plan_subtitle
import coachfoska.composeapp.generated.resources.nutrition_hub_plan_title
import coachfoska.composeapp.generated.resources.nutrition_hub_track_eyebrow
import coachfoska.composeapp.generated.resources.nutrition_hub_title
import coachfoska.composeapp.generated.resources.nutrition_hub_water_subtitle
import coachfoska.composeapp.generated.resources.nutrition_hub_water_title
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import org.jetbrains.compose.resources.stringResource
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.app.ui.components.HubImageCard
import com.coachfoska.app.ui.nutrition.components.FeaturedRecipeCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun NutritionHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onManualLog: () -> Unit,
    onPhotoLog: (String) -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onRecipeClick: (recipeId: String) -> Unit,
    onWaterClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }
    NutritionHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onManualLog = onManualLog,
        onPhotoLog = onPhotoLog,
        onHistoryClick = onHistoryClick,
        onRecipesClick = onRecipesClick,
        onRecipeClick = onRecipeClick,
        onWaterClick = onWaterClick
    )
}

@Composable
fun NutritionHubScreen(
    state: NutritionState,
    onPlanClick: () -> Unit,
    onManualLog: () -> Unit,
    onPhotoLog: (String) -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onRecipeClick: (recipeId: String) -> Unit,
    onWaterClick: () -> Unit
) {
    var showLogSheet by remember { mutableStateOf(false) }
    if (showLogSheet) {
        com.coachfoska.app.ui.nutrition.components.LogMealOptionsSheet(
            onDismiss = { showLogSheet = false },
            onManual = onManualLog,
            onPhotoPicked = onPhotoLog
        )
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = stringResource(Res.string.nutrition_hub_title),
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )

        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Log meal — primary entry point
            Button(
                onClick = { showLogSheet = true },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(Res.string.log_meal_button),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                )
            }

            // Featured recipes header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(Res.string.nutrition_hub_featured_recipes),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 1.5.sp,
                )
                Text(
                    text = stringResource(Res.string.common_see_all),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.clickable(onClick = onRecipesClick),
                )
            }

            // Featured recipes slider
            val featured = remember(state.allRecipes) { state.featuredRecipes }
            when {
                state.isRecipesLoading && state.allRecipes.isEmpty() ->
                    DsLoadingBox(modifier = Modifier.fillMaxWidth().height(150.dp))
                featured.isEmpty() ->
                    Text(
                        text = stringResource(Res.string.nutrition_hub_no_recipes),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    )
                else ->
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(end = 16.dp),
                    ) {
                        items(featured, key = { it.id }) { recipe ->
                            FeaturedRecipeCard(recipe = recipe, onClick = { onRecipeClick(recipe.id) })
                        }
                    }
            }

            // Other destinations
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_plan,
                    eyebrow = stringResource(Res.string.nutrition_hub_plan_eyebrow),
                    title = stringResource(Res.string.nutrition_hub_plan_title),
                    subtitle = stringResource(Res.string.nutrition_hub_plan_subtitle),
                    onClick = onPlanClick,
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                )
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = stringResource(Res.string.nutrition_hub_log_eyebrow),
                    title = stringResource(Res.string.nutrition_hub_history_title),
                    subtitle = stringResource(Res.string.nutrition_hub_history_subtitle),
                    onClick = onHistoryClick,
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                )
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = stringResource(Res.string.nutrition_hub_track_eyebrow),
                    title = stringResource(Res.string.nutrition_hub_water_title),
                    subtitle = stringResource(Res.string.nutrition_hub_water_subtitle),
                    onClick = onWaterClick,
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                )
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
