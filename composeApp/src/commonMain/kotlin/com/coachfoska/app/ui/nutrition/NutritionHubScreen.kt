package com.coachfoska.app.ui.nutrition

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_see_all
import coachfoska.composeapp.generated.resources.log_meal_button
import coachfoska.composeapp.generated.resources.nutrition_hub_featured_recipes
import coachfoska.composeapp.generated.resources.nutrition_hub_history_title
import coachfoska.composeapp.generated.resources.nutrition_hub_no_recipes
import coachfoska.composeapp.generated.resources.nutrition_hub_plan_title
import coachfoska.composeapp.generated.resources.nutrition_hub_title
import coachfoska.composeapp.generated.resources.nutrition_hub_water_title
import coachfoska.composeapp.generated.resources.start_logging_meals
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import org.jetbrains.compose.resources.stringResource
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.MacroSummaryRow
import com.coachfoska.app.ui.workout.components.QuickLinkRow
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsSectionHeader
import com.coachfoska.app.ui.nutrition.components.FeaturedRecipeCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val SquareShape = RoundedCornerShape(0.dp)

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
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        viewModel.onIntent(NutritionIntent.LoadDailySummary)
    }
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
    Surface(modifier = Modifier.fillMaxSize(), color = DsTheme.colors.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            BrandHeader()

            // Daily macro summary
            Surface(
                shape = SquareShape,
                color = DsTheme.colors.surface,
                border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    when {
                        state.isSummaryLoading && state.nutritionSummary == null ->
                            DsLoadingBox(modifier = Modifier.fillMaxWidth().height(72.dp))
                        state.nutritionSummary != null ->
                            MacroSummaryRow(state.nutritionSummary, state.macroTargets)
                        else ->
                            Text(
                                text = stringResource(Res.string.start_logging_meals),
                                style = MaterialTheme.typography.bodyMedium,
                                color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                            )
                    }
                }
            }

            // Log meal — primary entry point
            Button(
                onClick = { showLogSheet = true },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = SquareShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = DsTheme.colors.actionPrimary,
                    contentColor = DsTheme.colors.onActionPrimary,
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
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DsSectionHeader(
                    title = stringResource(Res.string.nutrition_hub_featured_recipes),
                    actionLabel = stringResource(Res.string.common_see_all),
                    onAction = onRecipesClick,
                )

                // Featured recipes slider
                val featured = remember(state.allRecipes) { state.featuredRecipes }
                when {
                    state.isRecipesLoading && state.allRecipes.isEmpty() ->
                        DsLoadingBox(modifier = Modifier.fillMaxWidth().height(150.dp))
                    featured.isEmpty() ->
                        Text(
                            text = stringResource(Res.string.nutrition_hub_no_recipes),
                            style = MaterialTheme.typography.bodyMedium,
                            color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
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
            }

            // Other destinations
            Column {
                QuickLinkRow(
                    icon = Icons.Filled.RestaurantMenu,
                    label = stringResource(Res.string.nutrition_hub_plan_title),
                    onClick = onPlanClick,
                )
                QuickLinkRow(
                    icon = Icons.Filled.History,
                    label = stringResource(Res.string.nutrition_hub_history_title),
                    onClick = onHistoryClick,
                )
                QuickLinkRow(
                    icon = Icons.Filled.WaterDrop,
                    label = stringResource(Res.string.nutrition_hub_water_title),
                    onClick = onWaterClick,
                )
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BrandHeader() {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(
            text = stringResource(Res.string.nutrition_hub_title),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.ExtraBold,
            color = DsTheme.colors.textPrimary,
        )
    }
}
