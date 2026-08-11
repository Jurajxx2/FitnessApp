package com.coachfoska.app.presentation.nutrition

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.nutrition.AnalyzeMealPhotoUseCase
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetActiveNutritionTargetUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipeByIdUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipesUseCase
import com.coachfoska.app.domain.usecase.nutrition.SearchFoodsUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCase
import com.coachfoska.app.domain.usecase.nutrition.ResolveMealPhotoUrlUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.core.logging.AppLogger as Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "NutritionViewModel"

class NutritionViewModel(
    private val getActiveMealPlanUseCase: GetActiveMealPlanUseCase,
    private val analyzeMealPhotoUseCase: AnalyzeMealPhotoUseCase,
    private val logMealUseCase: LogMealUseCase,
    private val getMealHistoryUseCase: GetMealHistoryUseCase,
    private val getRecipesUseCase: GetRecipesUseCase,
    private val searchFoodsUseCase: SearchFoodsUseCase,
    private val getFavoriteRecipeIdsUseCase: GetFavoriteRecipeIdsUseCase,
    private val toggleFavoriteRecipeUseCase: ToggleFavoriteRecipeUseCase,
    private val getRecipeByIdUseCase: GetRecipeByIdUseCase,
    private val getDailyNutritionSummaryUseCase: GetDailyNutritionSummaryUseCase,
    private val getActiveNutritionTargetUseCase: GetActiveNutritionTargetUseCase,
    private val calculateMacroTargetsUseCase: CalculateMacroTargetsUseCase,
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val lookupFoodByBarcodeUseCase: LookupFoodByBarcodeUseCase,
    private val resolveMealPhotoUrlUseCase: ResolveMealPhotoUrlUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(NutritionState(selectedDayOfWeek = todayDayOfWeek()))
    val state: StateFlow<NutritionState> = _state.asStateFlow()

    private var loadFavoritesJob: Job? = null
    private var loadDailySummaryJob: Job? = null
    private var resolveMealPhotoJob: Job? = null

    init {
        onIntent(NutritionIntent.LoadMealPlan)
        loadDailySummary()
    }

    fun onIntent(intent: NutritionIntent) {
        Napier.d("Intent received: ${intent::class.simpleName}", tag = TAG)
        when (intent) {
            NutritionIntent.LoadMealPlan -> loadMealPlan()
            NutritionIntent.LoadHistory -> loadHistory()
            NutritionIntent.LoadRecipes -> loadRecipes()
            is NutritionIntent.SelectMeal -> selectMeal(intent.mealId)
            is NutritionIntent.SelectMealLog -> selectMealLog(intent.logId)
            is NutritionIntent.LogMeal -> logMeal(intent)
            is NutritionIntent.AnalyzePhoto -> analyzePhoto(intent.imageBytes)
            NutritionIntent.DismissError -> _state.update { it.copy(error = null) }
            NutritionIntent.MealLogged -> _state.update { it.copy(mealLoggedSuccess = false) }
            is NutritionIntent.SearchFoods -> searchFoods(intent.query)
            is NutritionIntent.SelectDay -> _state.update { it.copy(selectedDayOfWeek = intent.dayOfWeek) }
            is NutritionIntent.ToggleFavoriteRecipe -> toggleFavoriteRecipe(intent.recipeId)
            NutritionIntent.ToggleFavoritesFilter -> _state.update { it.copy(showOnlyFavorites = !it.showOnlyFavorites) }
            is NutritionIntent.LoadCapturePrefill -> loadCapturePrefill(intent.recipeId, intent.mealId)
            NutritionIntent.CapturePrefillConsumed -> _state.update { it.copy(capturePrefill = null) }
            NutritionIntent.LoadDailySummary -> loadDailySummary()
            is NutritionIntent.LookupBarcode -> lookupBarcode(intent.barcode)
            NutritionIntent.BarcodeConsumed -> _state.update { it.copy(barcodeFood = null, barcodeNotFound = false) }
        }
    }

    private fun searchFoods(query: String) {
        if (query.isBlank()) {
            _state.update { it.copy(searchResults = emptyList()) }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isSearching = true) }
            searchFoodsUseCase(query)
                .onSuccess { results ->
                    _state.update { it.copy(isSearching = false, searchResults = results) }
                }
                .onFailure { e ->
                    Napier.e("searchFoods failed", e, tag = TAG)
                    _state.update { it.copy(isSearching = false, error = e.message) }
                }
        }
    }

    private fun loadMealPlan() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getActiveMealPlanUseCase(userId)
                .onSuccess { plan ->
                    _state.update { it.copy(isLoading = false, mealPlan = plan) }
                }
                .onFailure { e ->
                    Napier.e("loadMealPlan failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun loadRecipes() {
        viewModelScope.launch {
            _state.update { it.copy(isRecipesLoading = true, error = null) }
            getRecipesUseCase()
                .onSuccess { recipes -> _state.update { it.copy(isRecipesLoading = false, allRecipes = recipes) } }
                .onFailure { e ->
                    Napier.e("loadRecipes failed", e, tag = TAG)
                    _state.update { it.copy(isRecipesLoading = false, error = e.message) }
                }
        }
        loadFavoritesJob = viewModelScope.launch {
            getFavoriteRecipeIdsUseCase(userId)
                .onSuccess { ids -> _state.update { it.copy(favoriteRecipeIds = ids) } }
                .onFailure { e -> Napier.e("loadFavoriteRecipes failed", e, tag = TAG) }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true, error = null) }
            getMealHistoryUseCase(userId)
                .onSuccess { logs -> _state.update { it.copy(isHistoryLoading = false, mealHistory = logs) } }
                .onFailure { e ->
                    Napier.e("loadHistory failed", e, tag = TAG)
                    _state.update { it.copy(isHistoryLoading = false, error = e.message) }
                }
        }
    }

    private fun selectMeal(mealId: String) {
        val meal = _state.value.mealPlan?.meals?.firstOrNull { it.id == mealId }
        _state.update { it.copy(selectedMeal = meal) }
    }

    private fun selectMealLog(logId: String) {
        val log = _state.value.mealHistory.firstOrNull { it.id == logId }
        resolveMealPhotoJob?.cancel()
        // Reset immediately so a previous log's photo never flashes under the new selection.
        _state.update { it.copy(selectedMealLog = log, selectedMealPhotoUrl = null) }

        val path = log?.imageUrl ?: return
        resolveMealPhotoJob = viewModelScope.launch {
            resolveMealPhotoUrlUseCase(path)
                .onSuccess { url -> _state.update { it.copy(selectedMealPhotoUrl = url) } }
                .onFailure { e ->
                    // Best-effort: a resolution failure just means the photo doesn't render.
                    Napier.e("resolveMealPhotoUrl failed", e, tag = TAG)
                }
        }
    }

    private fun logMeal(intent: NutritionIntent.LogMeal) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true, error = null) }
            logMealUseCase(userId, intent.mealName, intent.foods, intent.notes, intent.imageBytes)
                .onSuccess {
                    Napier.i("Meal logged", tag = TAG)
                    _state.update { it.copy(isLogging = false, mealLoggedSuccess = true) }
                }
                .onFailure { e ->
                    Napier.e("logMeal failed", e, tag = TAG)
                    _state.update { it.copy(isLogging = false, error = e.message) }
                }
        }
    }

    private fun analyzePhoto(imageBytes: ByteArray) {
        viewModelScope.launch {
            _state.update { it.copy(isAnalyzing = true, error = null) }
            analyzeMealPhotoUseCase(imageBytes)
                .onSuccess { analysis ->
                    _state.update {
                        it.copy(
                            isAnalyzing = false,
                            capturePrefill = CapturePrefill(
                                mealName = analysis.mealName,
                                foods = analysis.foods.map { f ->
                                    CapturePrefillFood(
                                        name = f.name,
                                        amount = f.amount,
                                        unit = f.unit,
                                        calories = f.calories,
                                        proteinG = f.proteinG,
                                        carbsG = f.carbsG,
                                        fatG = f.fatG
                                    )
                                }
                            )
                        )
                    }
                }
                .onFailure { e ->
                    Napier.e("analyzePhoto failed", e, tag = TAG)
                    _state.update { it.copy(isAnalyzing = false, error = "Couldn't analyze photo — enter details manually.") }
                }
        }
    }

    private fun toggleFavoriteRecipe(recipeId: String) {
        loadFavoritesJob?.cancel()
        val current = _state.value.favoriteRecipeIds
        val nowFavorite = recipeId !in current
        _state.update {
            it.copy(favoriteRecipeIds = if (nowFavorite) current + recipeId else current - recipeId)
        }
        viewModelScope.launch {
            toggleFavoriteRecipeUseCase(userId, recipeId, nowFavorite)
                .onFailure { e ->
                    Napier.e("toggleFavoriteRecipe($recipeId) failed", e, tag = TAG)
                    _state.update {
                        it.copy(favoriteRecipeIds = if (nowFavorite) it.favoriteRecipeIds - recipeId else it.favoriteRecipeIds + recipeId)
                    }
                }
        }
    }

    private fun loadCapturePrefill(recipeId: String?, mealId: String?) {
        if (recipeId == null && mealId == null) return
        viewModelScope.launch {
            if (recipeId != null) {
                getRecipeByIdUseCase(recipeId)
                    .onSuccess { recipe ->
                        if (recipe == null) return@onSuccess
                        _state.update {
                            it.copy(capturePrefill = CapturePrefill(
                                mealName = recipe.name,
                                foods = recipe.ingredients.map { ing ->
                                    CapturePrefillFood(
                                        name = ing.name,
                                        amount = ing.quantity ?: 1f,
                                        unit = ing.unit ?: "x",
                                        calories = ing.calories,
                                        proteinG = ing.proteinG,
                                        carbsG = ing.carbsG,
                                        fatG = ing.fatG
                                    )
                                }
                            ))
                        }
                    }
                    // Prefill is best-effort: failure degrades to blank capture, never blocks logging.
                    .onFailure { e -> Napier.e("prefill recipe $recipeId failed", e, tag = TAG) }
            } else if (mealId != null) {
                getActiveMealPlanUseCase(userId)
                    .onSuccess { plan ->
                        val meal = plan?.meals?.firstOrNull { it.id == mealId } ?: return@onSuccess
                        _state.update {
                            it.copy(capturePrefill = CapturePrefill(
                                mealName = meal.name,
                                foods = meal.foods.map { mf ->
                                    CapturePrefillFood(
                                        name = mf.name,
                                        amount = mf.amountGrams,
                                        unit = "g",
                                        calories = mf.calories,
                                        proteinG = mf.proteinG,
                                        carbsG = mf.carbsG,
                                        fatG = mf.fatG
                                    )
                                }
                            ))
                        }
                    }
                    .onFailure { e -> Napier.e("prefill meal $mealId failed", e, tag = TAG) }
            }
        }
    }

    private fun loadDailySummary() {
        loadDailySummaryJob?.cancel()
        loadDailySummaryJob = viewModelScope.launch {
            _state.update { it.copy(isSummaryLoading = true) }
            val today = todayDate()
            val summaryDeferred = async { getDailyNutritionSummaryUseCase(userId, today) }
            val profileDeferred = async { getUserProfileUseCase(userId) }
            val targetDeferred = async { getActiveNutritionTargetUseCase(userId) }

            val summaryResult = summaryDeferred.await()
            val profileResult = profileDeferred.await()
            val targetResult = targetDeferred.await()

            summaryResult.onFailure { e -> Napier.e("loadDailySummary summary failed", e, tag = TAG) }
            profileResult.onFailure { e -> Napier.e("loadDailySummary profile failed", e, tag = TAG) }
            targetResult.onFailure { e -> Napier.e("loadDailySummary target failed; using calculated fallback", e, tag = TAG) }

            val targets = targetResult.getOrNull()
                ?: profileResult.getOrNull()?.let { calculateMacroTargetsUseCase(it) }
            _state.update {
                it.copy(
                    isSummaryLoading = false,
                    nutritionSummary = summaryResult.getOrNull() ?: it.nutritionSummary,
                    macroTargets = targets ?: it.macroTargets,
                )
            }
        }
    }

    private fun lookupBarcode(barcode: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLookingUpBarcode = true, barcodeNotFound = false, error = null) }
            lookupFoodByBarcodeUseCase(barcode)
                .onSuccess { food ->
                    _state.update {
                        if (food != null) {
                            it.copy(isLookingUpBarcode = false, barcodeFood = food)
                        } else {
                            it.copy(isLookingUpBarcode = false, barcodeNotFound = true)
                        }
                    }
                }
                .onFailure { e ->
                    Napier.e("lookupBarcode failed", e, tag = TAG)
                    _state.update { it.copy(isLookingUpBarcode = false, error = e.message) }
                }
        }
    }

    private fun todayDayOfWeek(): Int = todayDate().dayOfWeek.ordinal
}
