package com.coachfoska.app.core.di

import com.coachfoska.app.core.network.SupabaseClientProvider
import com.coachfoska.app.core.logging.AppLogger
import com.coachfoska.app.data.remote.datasource.ActivityRemoteDataSource
import com.coachfoska.app.data.remote.datasource.AppConfigRemoteDataSource
import com.coachfoska.app.data.remote.datasource.AuthRemoteDataSource
import com.coachfoska.app.data.remote.datasource.CheckInRemoteDataSource
import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.data.remote.datasource.MealPhotoDataSource
import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.data.remote.datasource.OnboardingRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.repository.ActivityRepositoryImpl
import com.coachfoska.app.data.repository.AppConfigRepositoryImpl
import com.coachfoska.app.data.repository.AuthRepositoryImpl
import com.coachfoska.app.data.repository.CheckInRepositoryImpl
import com.coachfoska.app.data.repository.ExerciseRepositoryImpl
import com.coachfoska.app.data.repository.MealRepositoryImpl
import com.coachfoska.app.data.repository.OnboardingRepositoryImpl
import com.coachfoska.app.data.repository.UserRepositoryImpl
import com.coachfoska.app.data.repository.WorkoutRepositoryImpl
import com.coachfoska.app.domain.repository.ActivityRepository
import com.coachfoska.app.domain.repository.AppConfigRepository
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.domain.repository.CheckInRepository
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.OnboardingRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.activity.GetActivityHistoryUseCase
import com.coachfoska.app.domain.usecase.activity.LogGeneralActivityUseCase
import com.coachfoska.app.domain.usecase.checkin.GetCheckInHistoryUseCase
import com.coachfoska.app.domain.usecase.checkin.GetCurrentWeekCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.ResolveCheckInPhotoUrlUseCase
import com.coachfoska.app.domain.usecase.checkin.SubmitCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.UploadCheckInPhotoUseCase
import com.coachfoska.app.domain.usecase.auth.GetCurrentUserUseCase
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import com.coachfoska.app.domain.usecase.auth.SendOtpUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithAppleUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithGoogleUseCase
import com.coachfoska.app.domain.usecase.auth.SignOutUseCase
import com.coachfoska.app.domain.usecase.auth.VerifyOtpUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseCategoriesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetFavoriteExerciseIdsUseCase
import com.coachfoska.app.domain.usecase.exercise.ToggleFavoriteExerciseUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.recipe.ScaleRecipeUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipeByIdUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipesUseCase
import com.coachfoska.app.domain.usecase.nutrition.ScaleFoodToPortionUseCase
import com.coachfoska.app.domain.usecase.nutrition.SearchFoodsUseCase
import com.coachfoska.app.domain.usecase.nutrition.AnalyzeMealPhotoUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.domain.usecase.onboarding.SaveOnboardingUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.profile.LogWeightUseCase
import com.coachfoska.app.domain.usecase.profile.UpdateUserProfileUseCase
import com.coachfoska.app.core.theme.ThemeRepository
import com.russhwolf.settings.Settings
import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.data.ai.ClaudeAiProvider
import com.coachfoska.app.data.remote.datasource.ChatRemoteDataSource
import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.data.remote.datasource.ChatStorageDataSource
import com.coachfoska.app.data.repository.ChatRepositoryImpl
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.domain.usecase.chat.MarkMessagesReadUseCase
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.chat.SendAiChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.SendHumanChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.UploadChatImageUseCase
import com.coachfoska.app.presentation.chat.ChatHubViewModel
import com.coachfoska.app.presentation.chat.ChatViewModel
import com.coachfoska.app.domain.usecase.workout.GetAllWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.CalculateEstimated1RMUseCase
import com.coachfoska.app.domain.usecase.workout.GetPreviousExerciseLogsUseCase
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.workout.DeleteUserWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.ForkWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseRecordsUseCase
import com.coachfoska.app.domain.usecase.workout.GetProgressDashboardUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutsPerWeekUseCase
import com.coachfoska.app.domain.usecase.workout.SaveUserWorkoutUseCase
import com.coachfoska.app.presentation.workout.ActiveSessionViewModel
import com.coachfoska.app.presentation.workout.ProgressDashboardViewModel
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryViewModel
import com.coachfoska.app.presentation.activity.ActivityLogViewModel
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.app.presentation.checkin.CheckInViewModel
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.presentation.splash.SplashViewModel
import com.coachfoska.app.presentation.home.HomeViewModel
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.presentation.recipe.RecipeDetailViewModel
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import com.coachfoska.app.presentation.profile.ProfileViewModel
import com.coachfoska.app.presentation.workout.WorkoutEditorViewModel
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.data.remote.datasource.HydrationRemoteDataSource
import com.coachfoska.app.data.repository.HydrationRepositoryImpl
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import com.coachfoska.app.domain.usecase.debug.ResetOnboardingUseCase
import com.coachfoska.app.presentation.settings.SettingsViewModel
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase
import com.coachfoska.app.domain.usecase.hydration.AddWaterContainerUseCase
import com.coachfoska.app.domain.usecase.hydration.DeleteWaterContainerUseCase
import com.coachfoska.app.domain.usecase.hydration.ToggleFavoriteWaterContainerUseCase
import com.coachfoska.app.presentation.hydration.HydrationViewModel
import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.Logging
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import org.koin.core.module.dsl.viewModel
import org.koin.core.module.dsl.viewModelOf
import org.koin.dsl.module

val themeModule = module {
    single { Settings() }
    single { ThemeRepository(get()) }
}

val networkModule = module {
    single { SupabaseClientProvider.client }

    single {
        HttpClient {
            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                    coerceInputValues = true
                })
            }
            install(Logging) {
                logger = AppLogger.ktorLogger
                level = AppLogger.networkLogLevel
                sanitizeHeader { header -> AppLogger.shouldRedactHeader(header) }
            }
        }
    }
}

val dataSourceModule = module {
    single { AuthRemoteDataSource(get(), get()) }
    single { UserRemoteDataSource(get()) }
    single { ActivityRemoteDataSource(get()) }
    single { CheckInRemoteDataSource(get()) }
    single { WorkoutRemoteDataSource(get()) }
    single { ExerciseSupabaseDataSource(get()) }
    single { MealRemoteDataSource(get()) }
    single { MealPhotoDataSource(get(), get()) }
    single { AppConfigRemoteDataSource(get()) }
    single { OnboardingRemoteDataSource(get()) }
}

val repositoryModule = module {
    single<AuthRepository> { AuthRepositoryImpl(get(), get()) }
    single<UserRepository> { UserRepositoryImpl(get()) }
    single<ActivityRepository> { ActivityRepositoryImpl(get()) }
    single<CheckInRepository> { CheckInRepositoryImpl(get()) }
    single<WorkoutRepository> { WorkoutRepositoryImpl(get()) }
    single<ExerciseRepository> { ExerciseRepositoryImpl(get()) }
    single<MealRepository> { MealRepositoryImpl(get(), get()) }
    single<AppConfigRepository> { AppConfigRepositoryImpl(get()) }
    single<OnboardingRepository> { OnboardingRepositoryImpl(get(), get()) }
}

val useCaseModule = module {
    // Auth
    single { ObserveSessionUseCase(get()) }
    factory { SendOtpUseCase(get()) }
    factory { VerifyOtpUseCase(get()) }
    factory { SignInWithGoogleUseCase(get(), get()) }
    factory { SignInWithAppleUseCase(get(), get()) }
    factory { SignOutUseCase(get()) }
    factory { GetCurrentUserUseCase(get()) }

    // Workout
    factory { GetAssignedWorkoutsUseCase(get()) }
    factory { GetAllWorkoutsUseCase(get()) }
    factory { GetWorkoutByIdUseCase(get()) }
    factory { LogWorkoutUseCase(get()) }
    factory { GetWorkoutHistoryUseCase(get()) }
    factory { SaveUserWorkoutUseCase(get()) }
    factory { DeleteUserWorkoutUseCase(get()) }
    factory { ForkWorkoutUseCase(get()) }

    // Workout analytics
    factory { CalculateEstimated1RMUseCase() }
    factory { GetPreviousExerciseLogsUseCase(get()) }
    factory { CheckPersonalRecordUseCase(get(), get()) }
    factory { GetExerciseHistoryUseCase(get()) }
    factory { GetExerciseRecordsUseCase(get()) }
    factory { GetProgressDashboardUseCase(get()) }
    factory { GetWorkoutsPerWeekUseCase(get()) }

    // Activity
    factory { LogGeneralActivityUseCase(get()) }
    factory { GetActivityHistoryUseCase(get()) }

    // Check-In
    factory { SubmitCheckInUseCase(get(), get()) }
    factory { GetCheckInHistoryUseCase(get()) }
    factory { GetCurrentWeekCheckInUseCase(get()) }
    factory { UploadCheckInPhotoUseCase(get()) }
    factory { ResolveCheckInPhotoUrlUseCase(get()) }

    // Nutrition
    factory { GetActiveMealPlanUseCase(get()) }
    factory { AnalyzeMealPhotoUseCase(get()) }
    factory { LogMealUseCase(get()) }
    factory { GetMealHistoryUseCase(get()) }
    factory { GetDailyNutritionSummaryUseCase(get()) }
    factory { GetRecipesUseCase(get()) }
    factory { GetRecipeByIdUseCase(get()) }
    factory { SearchFoodsUseCase(get()) }
    factory { ScaleFoodToPortionUseCase() }
    factory { ScaleRecipeUseCase() }
    factory { GetFavoriteRecipeIdsUseCase(get()) }
    factory { ToggleFavoriteRecipeUseCase(get()) }
    factory { CalculateMacroTargetsUseCase() }

    // Profile
    factory { GetUserProfileUseCase(get()) }
    factory { UpdateUserProfileUseCase(get()) }
    factory { SaveOnboardingUseCase(get()) }
    factory { GetWeightHistoryUseCase(get()) }
    factory { LogWeightUseCase(get()) }

    // Config
    factory { GetAppLinksUseCase(get()) }

    // Debug
    factory { ResetOnboardingUseCase(get()) }

    // Exercise
    factory { GetExercisesUseCase(get()) }
    factory { GetExerciseByIdUseCase(get()) }
    factory { GetExerciseCategoriesUseCase(get()) }
    factory { GetFavoriteExerciseIdsUseCase(get()) }
    factory { ToggleFavoriteExerciseUseCase(get()) }
}

val viewModelModule = module {
    viewModelOf(::SplashViewModel)
    viewModelOf(::AuthViewModel)
    viewModelOf(::SettingsViewModel)
    viewModel { (userId: String) -> HomeViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }
    viewModel { (userId: String) -> WorkoutViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }
    viewModel { (userId: String) -> ActivityLogViewModel(get(), get(), userId) }
    viewModel { (userId: String) -> NutritionViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }
    viewModel { (recipeId: String, userId: String) -> RecipeDetailViewModel(get(), get(), get(), get(), recipeId, userId) }
    viewModel { (userId: String) -> ProfileViewModel(get(), get(), get(), get(), get(), get(), userId) }
    viewModel { (userId: String) -> OnboardingViewModel(get(), userId) }
    viewModel { (userId: String) -> ExerciseViewModel(get(), get(), get(), get(), get(), userId) }
    viewModel { (userId: String) ->
        CheckInViewModel(
            submitCheckInUseCase = get(),
            getCheckInHistoryUseCase = get(),
            getCurrentWeekCheckInUseCase = get(),
            uploadCheckInPhotoUseCase = get(),
            getUserProfileUseCase = get(),
            userId = userId,
        )
    }
    viewModel { (userId: String) ->
        ActiveSessionViewModel(get(), get(), get(), get(), get(), get(), userId)
    }
    viewModel { (userId: String) ->
        ProgressDashboardViewModel(get(), get(), userId)
    }
    viewModel { (userId: String, logId: String) ->
        PostWorkoutSummaryViewModel(get(), userId, logId)
    }
    viewModel { (userId: String) ->
        WorkoutEditorViewModel(get(), get(), get(), userId)
    }
}

val chatModule = module {
    // AI provider — swap ClaudeAiProvider for GeminiAiProvider here to change backends.
    // ClaudeAiProvider calls the ai-proxy edge function; no API key ships in the app.
    single<ChatAiProvider> { ClaudeAiProvider(get(), get()) }

    single { ChatRemoteDataSource(get()) }
    single { ChatStorageDataSource(get()) }
    single<ChatRepository> { ChatRepositoryImpl(get(), get(), get()) }

    factory { ObserveChatMessagesUseCase(get()) }
    factory { SendHumanChatMessageUseCase(get()) }
    factory { SendAiChatMessageUseCase(get(), get()) }
    factory { MarkMessagesReadUseCase(get()) }
    factory { UploadChatImageUseCase(get()) }

    viewModel { (userId: String, chatType: ChatType) ->
        ChatViewModel(get(), get(), get(), get(), get(), userId, chatType)
    }
    viewModel { (userId: String) -> ChatHubViewModel(get(), userId) }
}

val pushModule = module {
    single { DeviceTokenDataSource(get()) }
    // DeviceTokenRepository is provided by platform modules (androidModule / iosModule)
    // because the platform string ("android" / "ios") differs per platform
}

val hydrationModule = module {
    single { HydrationRemoteDataSource(get()) }
    single<HydrationRepository> { HydrationRepositoryImpl(get()) }
    factory { CalculateWaterGoalUseCase() }
    factory { GetWaterContainersUseCase(get()) }
    factory { AddWaterContainerUseCase(get()) }
    factory { DeleteWaterContainerUseCase(get()) }
    factory { ToggleFavoriteWaterContainerUseCase(get()) }
    viewModel { (userId: String) ->
        HydrationViewModel(
            hydrationRepository = get(),
            getUserProfileUseCase = get(),
            calculateWaterGoalUseCase = get(),
            getWaterContainersUseCase = get(),
            addWaterContainerUseCase = get(),
            deleteWaterContainerUseCase = get(),
            toggleFavoriteWaterContainerUseCase = get(),
            reminderScheduler = get(),
            userId = userId,
        )
    }
}

val appModules = listOf(
    themeModule,
    networkModule,
    dataSourceModule,
    repositoryModule,
    useCaseModule,
    viewModelModule,
    chatModule,
    pushModule,
    hydrationModule
)
