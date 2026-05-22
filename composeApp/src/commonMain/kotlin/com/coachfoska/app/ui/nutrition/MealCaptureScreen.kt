package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
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
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTextField
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.app.ui.components.MediaCaptureBottomSheet
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

data class FoodEntry(
    val name: String,
    val calories: String,
    val protein: String,
    val carbs: String,
    val fat: String
)

@Composable
fun MealCaptureRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.mealLoggedSuccess) {
        if (state.mealLoggedSuccess) {
            viewModel.onIntent(NutritionIntent.MealLogged)
            onBackClick()
        }
    }

    MealCaptureScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealCaptureScreen(
    state: NutritionState,
    onIntent: (NutritionIntent) -> Unit,
    onBackClick: () -> Unit
) {
    var mealName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var foods by remember { mutableStateOf(listOf(FoodEntry("", "", "", "", ""))) }
    var mediaUri by remember { mutableStateOf<String?>(null) }
    var showMediaSheet by remember { mutableStateOf(false) }
    var searchingIndex by remember { mutableStateOf<Int?>(null) }

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
                            calories = food.calories.toInt().toString(),
                            protein = food.proteinG.toString(),
                            carbs = food.carbsG.toString(),
                            fat = food.fatG.toString()
                        )
                    }
                }
                searchingIndex = null
            }
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "RECORD MEAL", onBackClick = onBackClick)
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
        CoachTextField(
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
                contentDescription = "Meal photo",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp))
            )
        }

        CoachSectionHeader(text = stringResource(Res.string.food_items_section))

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
                onClick = { foods = foods + FoodEntry("", "", "", "", "") },
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

        CoachTextField(
            value = notes,
            onValueChange = { notes = it },
            label = stringResource(Res.string.notes_optional),
            singleLine = false
        )

        state.error?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }

        CoachButton(
            text = stringResource(Res.string.save_meal),
            onClick = {
                val mealLogFoods = foods.filter { it.name.isNotBlank() }.map {
                    MealLogFood(
                        id = "", mealLogId = "",
                        name = it.name,
                        amount = 100f,
                        unit = "g",
                        calories = it.calories.toFloatOrNull() ?: 0f,
                        proteinG = it.protein.toFloatOrNull() ?: 0f,
                        carbsG = it.carbs.toFloatOrNull() ?: 0f,
                        fatG = it.fat.toFloatOrNull() ?: 0f
                    )
                }
                onIntent(
                    NutritionIntent.LogMeal(
                        mealName = mealName,
                        foods = mealLogFoods,
                        notes = notes.ifBlank { null },
                        photoUri = mediaUri
                    )
                )
            },
            enabled = mealName.isNotBlank() && foods.any { it.name.isNotBlank() },
            isLoading = state.isLogging
        )

        Spacer(modifier = Modifier.height(48.dp))
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
            Text("SEARCH FOOD", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(16.dp))
            CoachTextField(
                value = query,
                onValueChange = { 
                    query = it
                    onSearch(it)
                },
                label = "Type food name…",
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
                            Text("${food.calories.toInt()} kcal", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
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
    onSearch: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(Res.string.food_label, index),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
                if (onRemove != null) {
                    IconButton(onClick = onRemove, modifier = Modifier.size(24.dp)) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = stringResource(Res.string.remove_cd),
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                CoachTextField(
                    value = food.name,
                    onValueChange = { onUpdate(food.copy(name = it)) },
                    label = stringResource(Res.string.food_name_label),
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    onClick = onSearch,
                    modifier = Modifier.size(48.dp).padding(top = 8.dp),
                    colors = IconButtonDefaults.iconButtonColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f))
                ) {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = MaterialTheme.colorScheme.primary)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CoachTextField(
                    value = food.calories,
                    onValueChange = { onUpdate(food.copy(calories = it)) },
                    label = stringResource(Res.string.kcal_label),
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
                CoachTextField(
                    value = food.protein,
                    onValueChange = { onUpdate(food.copy(protein = it)) },
                    label = stringResource(Res.string.protein_label),
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )
            }
        }
    }
}
