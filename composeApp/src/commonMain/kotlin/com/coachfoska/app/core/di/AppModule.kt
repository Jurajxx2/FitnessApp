package com.coachfoska.app.core.di

import com.coachfoska.app.core.network.SupabaseClientProvider
import com.coachfoska.app.data.remote.datasource.AuthRemoteDataSource
import com.coachfoska.app.data.remote.datasource.ExerciseApiDataSource
import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.repository.AuthRepositoryImpl
import com.coachfoska.app.data.repository.ExerciseRepositoryImpl
import com.coachfoska.app.data.repository.MealRepositoryImpl
import com.coachfoska.app.data.repository.UserRepositoryImpl
import com.coachfoska.app.data.repository.WorkoutRepositoryImpl
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.auth.GetCurrentUserUseCase
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import com.coachfoska.app.domain.usecase.auth.SendOtpUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithAppleUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithGoogleUseCase
import com.coachfoska.app.domain.usecase.auth.SignOutUseCase
import com.coachfoska.app.domain.usecase.auth.VerifyOtpUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseCategoriesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesByCategoryUseCase
import com.coachfoska.app.domain.usecase.exercise.SearchExercisesUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import com.coachfoska.app.domain.usecase.profile.CompleteOnboardingUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.profile.LogWeightUseCase
import com.coachfoska.app.domain.usecase.profile.UpdateUserProfileUseCase
import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.core.theme.ThemeRepository
import com.russhwolf.settings.Settings
import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.data.ai.ClaudeAiProvider
import com.coachfoska.app.data.remote.datasource.ChatRemoteDataSource
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
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.presentation.splash.SplashViewModel
import com.coachfoska.app.presentation.home.HomeViewModel
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import com.coachfoska.app.presentation.profile.ProfileViewModel
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
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
        }
    }
}

val dataSourceModule = module {
    single { AuthRemoteDataSource(get(), get()) }
    single { UserRemoteDataSource(get()) }
    single { WorkoutRemoteDataSource(get()) }
    single { ExerciseApiDataSource(get()) }
    single { MealRemoteDataSource(get()) }
}

val repositoryModule = module {
    single<AuthRepository> { AuthRepositoryImpl(get(), get()) }
    single<UserRepository> { UserRepositoryImpl(get()) }
    single<WorkoutRepository> { WorkoutRepositoryImpl(get()) }
    single<ExerciseRepository> { ExerciseRepositoryImpl(get()) }
    single<MealRepository> { MealRepositoryImpl(get()) }
}

val useCaseModule = module {
    // Auth
    factory { ObserveSessionUseCase(get()) }
    factory { SendOtpUseCase(get()) }
    factory { VerifyOtpUseCase(get()) }
    factory { SignInWithGoogleUseCase(get(), get()) }
    factory { SignInWithAppleUseCase(get(), get()) }
    factory { SignOutUseCase(get()) }
    factory { GetCurrentUserUseCase(get()) }

    // Workout
    factory { GetAssignedWorkoutsUseCase(get()) }
    factory { GetWorkoutByIdUseCase(get()) }
    factory { LogWorkoutUseCase(get()) }
    factory { GetWorkoutHistoryUseCase(get()) }

    // Nutrition
    factory { GetActiveMealPlanUseCase(get()) }
    factory { LogMealUseCase(get()) }
    factory { GetMealHistoryUseCase(get()) }
    factory { GetDailyNutritionSummaryUseCase(get()) }

    // Profile
    factory { GetUserProfileUseCase(get()) }
    factory { UpdateUserProfileUseCase(get()) }
    factory { CompleteOnboardingUseCase(get()) }
    factory { GetWeightHistoryUseCase(get()) }
    factory { LogWeightUseCase(get()) }

    // Exercise
    factory { SearchExercisesUseCase(get()) }
    factory { GetExerciseByIdUseCase(get()) }
    factory { GetExerciseCategoriesUseCase(get()) }
    factory { GetExercisesByCategoryUseCase(get()) }
}

val viewModelModule = module {
    viewModelOf(::SplashViewModel)
    viewModelOf(::AuthViewModel)
    viewModel { (userId: String) -> HomeViewModel(get(), get(), get(), get(), userId) }
    viewModel { (userId: String) -> WorkoutViewModel(get(), get(), get(), get(), userId) }
    viewModel { (userId: String) -> NutritionViewModel(get(), get(), get(), userId) }
    viewModel { (userId: String) -> ProfileViewModel(get(), get(), get(), get(), get(), get(), userId) }
    viewModel { (userId: String) -> OnboardingViewModel(get(), userId) }
    viewModelOf(::ExerciseViewModel)
}

val chatModule = module {
    // AI provider — swap ClaudeAiProvider for GeminiAiProvider here to change backends
    single<ChatAiProvider> { ClaudeAiProvider(get(), BuildKonfig.ANTHROPIC_API_KEY) }

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

val appModules = listOf(
    themeModule,
    networkModule,
    dataSourceModule,
    repositoryModule,
    useCaseModule,
    viewModelModule,
    chatModule
)
