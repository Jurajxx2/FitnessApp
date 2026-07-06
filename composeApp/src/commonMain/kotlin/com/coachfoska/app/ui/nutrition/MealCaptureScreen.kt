package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
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
import coil3.compose.AsyncImage
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsSectionLabel
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.app.ui.components.MediaCaptureBottomSheet
import com.coachfoska.app.theme.Sizes
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import coachfoska.composeapp.generated.resources.common_search_cd
import coachfoska.composeapp.generated.resources.meal_analyzing_photo
import coachfoska.composeapp.generated.resources.meal_kcal_format
import coachfoska.composeapp.generated.resources.meal_macro_summary
import coachfoska.composeapp.generated.resources.meal_photo_cd
import coachfoska.composeapp.generated.resources.meal_search_food_title
import coachfoska.composeapp.generated.resources.meal_search_type_food_label
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

data class FoodEntry(
    val name: String,
    val amount: String = "100",
    val unit: String = "g",
    // Base macros per `baseServingSize` of `baseServingUnit`. When the user types macros manually
    // (no Food selected), these equal the displayed macros and ratio == 1.
    val baseCalories: Float = 0f,
    val basePro: Float = 0f,
    val baseCarbs: Float = 0f,
    val baseFat: Float = 0f,
    val baseServingSize: Float = 100f,
    val baseServingUnit: String = "g",
) {
    private val ratio: Float
        get() = when {
            unit != baseServingUnit -> 1f
            baseServingSize <= 0f   -> 0f
            else                    -> (amount.toFloatOrNull() ?: 0f) / baseServingSize
        }
    val calories: Float get() = baseCalories * ratio
    val protein:  Float get() = basePro     * ratio
    val carbs:    Float get() = baseCarbs   * ratio
    val fat:      Float get() = baseFat     * ratio
}

@Composable
fun MealCaptureRoute(
    userId: String,
    recipeId: String? = null,
    mealId: String? = null,
    photoUri: String? = null,
    analyze: Boolean = false,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val readBytes = com.coachfoska.app.core.util.rememberUriBytesReader()

    LaunchedEffect(recipeId, mealId) {
        viewModel.onIntent(NutritionIntent.LoadCapturePrefill(recipeId, mealId))
    }

    LaunchedEffect(photoUri, analyze) {
        if (analyze && photoUri != null) {
            val bytes = readBytes(photoUri)
            if (bytes != null) {
                viewModel.onIntent(NutritionIntent.AnalyzePhoto(bytes))
            }
        }
    }

    LaunchedEffect(state.mealLoggedSuccess) {
        if (state.mealLoggedSuccess) {
            viewModel.onIntent(NutritionIntent.MealLogged)
            onBackClick()
        }
    }

    MealCaptureScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick,
        initialPhotoUri = photoUri
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealCaptureScreen(
    state: NutritionState,
    onIntent: (NutritionIntent) -> Unit,
    onBackClick: () -> Unit,
    initialPhotoUri: String? = null
) {
    var mealName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var foods by remember { mutableStateOf(listOf(FoodEntry(""))) }
    var mediaUri by remember { mutableStateOf(initialPhotoUri) }
    var showMediaSheet by remember { mutableStateOf(false) }
    var searchingIndex by remember { mutableStateOf<Int?>(null) }
    val readBytes = com.coachfoska.app.core.util.rememberUriBytesReader()

    LaunchedEffect(state.capturePrefill) {
        val prefill = state.capturePrefill ?: return@LaunchedEffect
        // Only seed untouched forms — never clobber user input.
        if (mealName.isBlank() && foods == listOf(FoodEntry(""))) {
            mealName = prefill.mealName
            foods = prefill.foods.map { f ->
                FoodEntry(
                    name = f.name,
                    amount = f.amount.toString().trimEnd('0').trimEnd('.'),
                    unit = f.unit,
                    baseCalories = f.calories,
                    basePro = f.proteinG,
                    baseCarbs = f.carbsG,
                    baseFat = f.fatG,
                    baseServingSize = f.amount,
                    baseServingUnit = f.unit,
                )
            }
            onIntent(NutritionIntent.CapturePrefillConsumed)
        }
    }

    if (showMediaSheet) {
        MediaCaptureBottomSheet(
            mode = MediaCaptureMode.PHOTO,
            onDismiss = { showMediaSheet = false },
            onResult = { uri -> mediaUri = uri }
        )
    }

    if (searchingIndex != null) {
        FoodSearchDialog(
            state = state,
            onSearch = { onIntent(NutritionIntent.SearchFoods(it)) },
            onDismiss = { searchingIndex = null },
            onSelect = { food ->
                searchingIndex?.let { index ->
                    foods = foods.toMutableList().also {
                        it[index] = FoodEntry(
                            name = food.name,
                            amount = food.servingSize.toString().trimEnd('0').trimEnd('.'),
                            unit = food.servingUnit,
                            baseCalories = food.calories,
                            basePro = food.proteinG,
                            baseCarbs = food.carbsG,
                            baseFat = food.fatG,
                            baseServingSize = food.servingSize,
                            baseServingUnit = food.servingUnit,
                        )
                    }
                }
                searchingIndex = null
            }
        )
    }

    Box(modifier = Modifier.fillMaxSize()) {
    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = stringResource(Res.string.meal_capture_screen_title), onBackClick = onBackClick)
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
        DsTextField(
            value = mealName,
            onValueChange = { mealName = it },
            label = stringResource(Res.string.meal_name_label)
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = { showMediaSheet = true },
                modifier = Modifier.weight(1f).height(48.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = if (mediaUri != null)
                        MaterialTheme.colorScheme.onBackground
                    else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                ),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (mediaUri != null)
                        MaterialTheme.colorScheme.onBackground
                    else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f)
                )
            ) {
                Icon(
                    imageVector = if (mediaUri != null) Icons.Default.Check else Icons.Default.CameraAlt,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (mediaUri != null) stringResource(Res.string.photo_attached) else stringResource(Res.string.add_meal_photo),
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }

        if (mediaUri != null) {
            AsyncImage(
                model = mediaUri,
                contentDescription = stringResource(Res.string.meal_photo_cd),
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp))
            )
        }

        com.coachfoska.app.ui.nutrition.components.MacroRingSummary(
            calories = foods.sumOf { it.calories.toDouble() }.toFloat(),
            proteinG = foods.sumOf { it.protein.toDouble() }.toFloat(),
            carbsG = foods.sumOf { it.carbs.toDouble() }.toFloat(),
            fatG = foods.sumOf { it.fat.toDouble() }.toFloat(),
        )

        DsSectionLabel(text = stringResource(Res.string.food_items_section))

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            foods.forEachIndexed { i, food ->
                FoodEntryRow(
                    index = i + 1,
                    food = food,
                    onUpdate = { updated ->
                        foods = foods.toMutableList().also { it[i] = updated }
                    },
                    onRemove = if (foods.size > 1) {
                        { foods = foods.toMutableList().also { it.removeAt(i) } }
                    } else null,
                    onSearch = { searchingIndex = i }
                )
            }

            OutlinedButton(
                onClick = { foods = foods + FoodEntry("") },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onBackground),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f))
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(Res.string.add_food), style = MaterialTheme.typography.labelLarge)
            }
        }

        DsTextField(
            value = notes,
            onValueChange = { notes = it },
            label = stringResource(Res.string.notes_optional),
            singleLine = false
        )

        state.error?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }

        DsButton(
            text = stringResource(Res.string.save_meal),
            onClick = {
                val mealLogFoods = foods.filter { it.name.isNotBlank() }.map {
                    MealLogFood(
                        id = "", mealLogId = "",
                        name = it.name,
                        amount = it.amount.toFloatOrNull() ?: 100f,
                        unit = it.unit,
                        calories = it.calories,
                        proteinG = it.protein,
                        carbsG = it.carbs,
                        fatG = it.fat,
                    )
                }
                onIntent(
                    NutritionIntent.LogMeal(
                        mealName = mealName,
                        foods = mealLogFoods,
                        notes = notes.ifBlank { null },
                        imageBytes = mediaUri?.let { readBytes(it) }
                    )
                )
            },
            enabled = mealName.isNotBlank() && foods.any { it.name.isNotBlank() },
            isLoading = state.isLogging
        )

        Spacer(modifier = Modifier.height(48.dp))
        }
    }

        if (state.isAnalyzing) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background.copy(alpha = 0.85f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Text(
                        stringResource(Res.string.meal_analyzing_photo),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground,
                        letterSpacing = 1.sp
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodSearchDialog(
    state: NutritionState,
    onSearch: (String) -> Unit,
    onDismiss: () -> Unit,
    onSelect: (Food) -> Unit
) {
    var query by remember { mutableStateOf("") }
    
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(modifier = Modifier.fillMaxWidth().fillMaxHeight(0.8f).padding(24.dp)) {
            Text(stringResource(Res.string.meal_search_food_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(16.dp))
            DsTextField(
                value = query,
                onValueChange = { 
                    query = it
                    onSearch(it)
                },
                label = stringResource(Res.string.meal_search_type_food_label),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(16.dp))
            
            if (state.isSearching) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
            
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(state.searchResults) { food ->
                    Surface(
                        onClick = { onSelect(food) },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f)
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(food.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                                if (food.brand != null) {
                                    Text(food.brand, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f))
                                }
                            }
                            Text(stringResource(Res.string.meal_kcal_format, food.calories.toInt()), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FoodEntryRow(
    index: Int,
    food: FoodEntry,
    onUpdate: (FoodEntry) -> Unit,
    onRemove: (() -> Unit)?,
    onSearch: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.06f),
        ),
    ) {
        Column(
            modifier = Modifier
                .background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.04f),
                            MaterialTheme.colorScheme.surface,
                        ),
                    ),
                )
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(Res.string.food_label, index),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp,
                )
                if (onRemove != null) {
                    IconButton(onClick = onRemove, modifier = Modifier.size(Sizes.touchTarget)) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = stringResource(Res.string.remove_cd),
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DsTextField(
                    value = food.name,
                    onValueChange = { onUpdate(food.copy(name = it)) },
                    label = stringResource(Res.string.food_name_label),
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = onSearch,
                    modifier = Modifier.size(48.dp).padding(top = 8.dp),
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                    ),
                ) {
                    Icon(
                        Icons.Default.Search,
                        contentDescription = stringResource(Res.string.common_search_cd),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            com.coachfoska.app.ui.nutrition.components.PortionPicker(
                amount = food.amount,
                unit = food.unit,
                onAmountChange = { onUpdate(food.copy(amount = it)) },
                onUnitChange = { onUpdate(food.copy(unit = it)) },
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = stringResource(Res.string.meal_kcal_format, food.calories.toInt()),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(Res.string.meal_macro_summary, food.protein.toInt(), food.carbs.toInt(), food.fat.toInt()),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                )
            }
        }
    }
}
