package com.coachfoska.app

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.coachfoska.app.core.theme.ThemeRepository
import org.koin.compose.koinInject
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.coachfoska.app.core.logging.AppLogger
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import com.coachfoska.app.navigation.*
import com.coachfoska.app.ui.auth.EmailOtpRoute
import com.coachfoska.app.ui.auth.ForgotPasswordRoute
import com.coachfoska.app.ui.auth.VerifyOtpRoute
import com.coachfoska.app.ui.auth.WelcomeRoute
import com.coachfoska.app.ui.home.HomeRoute
import com.coachfoska.app.ui.legal.LegalDocumentRoute
import com.coachfoska.app.ui.nutrition.MealCaptureRoute
import com.coachfoska.app.ui.nutrition.MealDetailRoute
import com.coachfoska.app.ui.nutrition.MealHistoryDetailRoute
import com.coachfoska.app.ui.nutrition.MealHistoryRoute
import com.coachfoska.app.ui.nutrition.MealPlanDetailRoute
import com.coachfoska.app.ui.nutrition.NutritionHubRoute
import com.coachfoska.app.ui.nutrition.RecipesListRoute
import com.coachfoska.app.ui.recipe.RecipeDetailRoute
import com.coachfoska.app.ui.onboarding.OnboardingRoute
import com.coachfoska.app.ui.chat.ChatHubRoute
import com.coachfoska.app.ui.chat.ChatRoute
import com.coachfoska.app.ui.checkin.CheckInFormRoute
import com.coachfoska.app.ui.checkin.CheckInHistoryRoute
import com.coachfoska.app.ui.profile.AboutCoachScreen
import com.coachfoska.app.ui.profile.ProfileRoute
import com.coachfoska.app.ui.profile.ProgressRoute
import com.coachfoska.app.ui.profile.SettingsRoute
import com.coachfoska.app.ui.splash.SplashRoute
import com.coachfoska.app.ui.workout.ExerciseDetailRoute
import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.navigation.ActivityTypeSelector
import com.coachfoska.app.navigation.LogActivity
import com.coachfoska.app.ui.activity.ActivityTypeSelectorRoute
import com.coachfoska.app.ui.activity.LogActivityFormRoute
import com.coachfoska.app.ui.workout.LogWorkoutRoute
import com.coachfoska.app.ui.workout.WorkoutDetailRoute
import com.coachfoska.app.ui.workout.WorkoutHistoryRoute
import com.coachfoska.app.ui.workout.WorkoutHistoryDetailRoute
import com.coachfoska.app.ui.workout.ActivityHubRoute
import com.coachfoska.app.ui.workout.ExerciseLibraryRoute
import com.coachfoska.app.ui.workout.WorkoutPlanRoute
import com.coachfoska.app.ui.workout.ActiveSessionRoute
import com.coachfoska.app.ui.workout.PostWorkoutSummaryRoute
import com.coachfoska.app.ui.workout.ProgressDashboardRoute
import com.coachfoska.app.ui.workout.WorkoutEditorRoute
import com.coachfoska.app.ui.hydration.HydrationRoute
import com.coachfoska.designsystem.brand.BrandRegistry
import com.coachfoska.designsystem.components.DsBottomNav
import com.coachfoska.designsystem.components.DsBottomNavItem
import com.coachfoska.designsystem.gallery.GalleryScreen
import com.coachfoska.designsystem.theme.DsTheme
import org.jetbrains.compose.resources.stringResource

@Composable
fun App(openHumanChat: Boolean = false) {
    val themeRepository = koinInject<ThemeRepository>()
    val isDarkTheme by themeRepository.isDarkTheme.collectAsState()

    DsTheme(brand = BrandRegistry.fromId(BuildKonfig.BRAND_ID), darkTheme = isDarkTheme) {
        val navController = rememberNavController()
        // Derive the current user id from the singleton session observer so it survives
        // Activity recreation (where `remember` would reset to "" but rememberNavController
        // restores the back stack — previously leaving Home/Chat to query Postgres with id="").
        val observeSession = koinInject<ObserveSessionUseCase>()
        val sessionState by observeSession().collectAsState()
        val authenticatedUserId = (sessionState as? SessionAuthState.Authenticated)?.user?.id

        LaunchedEffect(openHumanChat, authenticatedUserId) {
            if (openHumanChat && authenticatedUserId != null) {
                navController.navigate(HumanCoachChat) {
                    launchSingleTop = true
                }
            }
        }

        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route

        LaunchedEffect(currentRoute) {
            AppLogger.screenViewed(currentRoute)
        }

        val authRoutes = listOf(
            Splash::class.qualifiedName,
            Welcome::class.qualifiedName,
            EmailOtp::class.qualifiedName,
            VerifyOtp::class.qualifiedName,
            ForgotPassword::class.qualifiedName,
            Onboarding::class.qualifiedName
        )
        val showBottomBar = currentRoute != null &&
            authRoutes.none { currentRoute.contains(it ?: "") }

        val selectedTab by remember(currentRoute) {
            derivedStateOf {
                currentRoute.toBottomNavTab() ?: BottomNavTab.Home
            }
        }

        Scaffold(
            bottomBar = {
                if (showBottomBar) {
                    val tabs = BottomNavTab.entries.map { tab ->
                        DsBottomNavItem(id = tab.name, icon = tab.icon, label = stringResource(tab.labelRes))
                    }
                    DsBottomNav(
                        items = tabs,
                        selectedId = selectedTab.name,
                        onItemSelected = { id ->
                            val tab = BottomNavTab.valueOf(id)
                            navController.navigateToBottomTab(
                                tab = tab,
                                resetToRoot = tab == selectedTab
                            )
                        }
                    )
                }
            }
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = Splash,
                modifier = Modifier.padding(innerPadding),
                enterTransition = {
                    slideInHorizontally(tween(300, easing = FastOutSlowInEasing)) { it } +
                        fadeIn(tween(200))
                },
                exitTransition = {
                    slideOutHorizontally(tween(250, easing = FastOutSlowInEasing)) { -it / 4 } +
                        fadeOut(tween(150))
                },
                popEnterTransition = {
                    slideInHorizontally(tween(300, easing = FastOutSlowInEasing)) { -it / 4 } +
                        fadeIn(tween(200))
                },
                popExitTransition = {
                    slideOutHorizontally(tween(250, easing = FastOutSlowInEasing)) { it } +
                        fadeOut(tween(150))
                }
            ) {
                // ── Splash ────────────────────────────────────────────────
                composable<Splash> {
                    SplashRoute(
                        onNavigateToHome = {
                            navController.navigate(Home) { popUpTo<Splash> { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            navController.navigate(Onboarding(userId)) { popUpTo<Splash> { inclusive = true } }
                        },
                        onNavigateToWelcome = {
                            navController.navigate(Welcome) { popUpTo<Splash> { inclusive = true } }
                        }
                    )
                }

                // ── Auth flow ─────────────────────────────────────────────
                composable<Welcome> {
                    WelcomeRoute(
                        onNavigateToEmailOtp = { navController.navigate(EmailOtp) },
                        onNavigateToHome = {
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            navController.navigate(Onboarding(userId)) { popUpTo(Welcome) { inclusive = true } }
                        }
                    )
                }

                composable<EmailOtp> {
                    EmailOtpRoute(
                        onBackClick = { navController.popBackStack() },
                        onOtpSent = { email -> navController.navigate(VerifyOtp(email)) },
                        onForgotPassword = { email -> navController.navigate(ForgotPassword(email)) },
                        onNavigateToHome = {
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            navController.navigate(Onboarding(userId)) { popUpTo(Welcome) { inclusive = true } }
                        }
                    )
                }

                composable<ForgotPassword> { backStackEntry ->
                    val route = backStackEntry.toRoute<ForgotPassword>()
                    ForgotPasswordRoute(
                        initialEmail = route.email,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<VerifyOtp> { backStackEntry ->
                    val route = backStackEntry.toRoute<VerifyOtp>()
                    VerifyOtpRoute(
                        email = route.email,
                        onBackClick = { navController.popBackStack() },
                        onNavigateToHome = {
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            navController.navigate(Onboarding(userId)) { popUpTo(Welcome) { inclusive = true } }
                        }
                    )
                }

                // ── Onboarding ────────────────────────────────────────────
                composable<Onboarding> { backStackEntry ->
                    val route = backStackEntry.toRoute<Onboarding>()
                    OnboardingRoute(
                        userId = route.userId,
                        onComplete = {
                            navController.navigate(Home) {
                                popUpTo(Onboarding(route.userId)) { inclusive = true }
                            }
                        },
                        onExit = { navController.popBackStack() }
                    )
                }

                // ── Home ──────────────────────────────────────────────────
                composable<Home>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        HomeRoute(
                            userId = currentUserId,
                            onChatClick = {
                                navController.navigateToBottomTabChild(BottomNavTab.Coach, HumanCoachChat)
                            },
                            onWaterClick = {
                                navController.navigateToBottomTabChild(BottomNavTab.Nutrition, Hydration)
                            },
                            onWorkoutClick = { workoutId ->
                                navController.navigateToBottomTabChild(BottomNavTab.Activity, WorkoutDetail(workoutId))
                            },
                            onStartWorkout = { workoutId ->
                                navController.navigateToBottomTabChild(BottomNavTab.Activity, ActiveSession(workoutId))
                            },
                            onLogMealClick = {
                                navController.navigateToBottomTabChild(BottomNavTab.Nutrition, MealCapture())
                            },
                            onGoToActivity = {
                                navController.navigateToBottomTab(BottomNavTab.Activity)
                            },
                        )
                    }
                }

                // ── Workout ───────────────────────────────────────────────
                composable<WorkoutList>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ActivityHubRoute(
                            userId = currentUserId,
                            onStartWorkout = { workoutId -> navController.navigate(ActiveSession(workoutId)) },
                            onResumeSession = { workoutId, logId -> navController.navigate(ActiveSession(workoutId, resumeLogId = logId)) },
                            onPlanClick = { navController.navigate(WorkoutPlan) },
                            onHistoryClick = { navController.navigate(WorkoutHistory) },
                            onLibraryClick = { navController.navigate(ExerciseLibrary) },
                            onProgressClick = { navController.navigate(ProgressDashboard) },
                            onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
                            onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) },
                            onLogGeneralActivityClick = { navController.navigate(ActivityTypeSelector) }
                        )
                    }
                }

                composable<WorkoutDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<WorkoutDetail>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        WorkoutDetailRoute(
                            workoutId = route.workoutId,
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) },
                            onStartWorkout = { workoutId -> navController.navigate(ActiveSession(workoutId)) },
                            onEditWorkout = { workoutId -> navController.navigate(WorkoutEditor(workoutId)) }
                        )
                    }
                }

                composable<ActiveSession> { backStackEntry ->
                    val route = backStackEntry.toRoute<ActiveSession>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ActiveSessionRoute(
                            workoutId = route.workoutId,
                            resumeLogId = route.resumeLogId,
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onWorkoutComplete = { logId ->
                                navController.navigate(PostWorkoutSummary(logId)) {
                                    popUpTo<ActiveSession> { inclusive = true }
                                }
                            },
                            onExerciseDetailClick = { exerciseId, exerciseName ->
                                navController.navigate(ExerciseDetail(exerciseId = exerciseId, exerciseName = exerciseName))
                            },
                        )
                    }
                }

                composable<PostWorkoutSummary> { backStackEntry ->
                    val route = backStackEntry.toRoute<PostWorkoutSummary>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        PostWorkoutSummaryRoute(
                            userId = currentUserId,
                            logId = route.logId,
                            onDone = { navController.popBackStack() },
                        )
                    }
                }

                composable<ExerciseDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<ExerciseDetail>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ExerciseDetailRoute(
                            userId = currentUserId,
                            exerciseId = route.exerciseId,
                            exerciseName = route.exerciseName,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<LogWorkout> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        LogWorkoutRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<ActivityTypeSelector> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) {
                        ActivityTypeSelectorRoute(
                            onBackClick = { navController.popBackStack() },
                            onTypeSelected = { type -> navController.navigate(LogActivity(type.name)) }
                        )
                    }
                }

                composable<LogActivity> { backStackEntry ->
                    val route: LogActivity = backStackEntry.toRoute()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        LogActivityFormRoute(
                            userId = currentUserId,
                            type = ActivityType.fromStorageValue(route.type),
                            onBackClick = { navController.popBackStack() },
                            onSaved = {
                                navController.popBackStack()
                                navController.popBackStack()
                            }
                        )
                    }
                }

                composable<WorkoutHistory> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        WorkoutHistoryRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onLogClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) },
                            onProgressClick = { navController.navigate(ProgressDashboard) },
                        )
                    }
                }

                composable<ProgressDashboard> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ProgressDashboardRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                        )
                    }
                }

                composable<WorkoutHistoryDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<WorkoutHistoryDetail>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        WorkoutHistoryDetailRoute(
                            logId = route.logId,
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onExerciseDetailClick = { exerciseId, exerciseName ->
                                navController.navigate(ExerciseDetail(exerciseId = exerciseId, exerciseName = exerciseName))
                            },
                        )
                    }
                }

                composable<WorkoutPlan> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        WorkoutPlanRoute(
                            userId = currentUserId,
                            onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
                            onLogWorkoutClick = { navController.navigate(LogWorkout) },
                            onCreateWorkout = { navController.navigate(WorkoutEditor()) },
                            onEditWorkout = { workoutId -> navController.navigate(WorkoutEditor(workoutId)) },
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<WorkoutEditor> { backStackEntry ->
                    val route = backStackEntry.toRoute<WorkoutEditor>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        WorkoutEditorRoute(
                            userId = currentUserId,
                            workoutId = route.workoutId,
                            onDone = { navController.popBackStack() },
                        )
                    }
                }

                composable<ExerciseLibrary> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ExerciseLibraryRoute(
                            userId = currentUserId,
                            onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) },
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                // ── Nutrition ─────────────────────────────────────────────
                composable<MealPlan>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        NutritionHubRoute(
                            userId = currentUserId,
                            onPlanClick = { navController.navigate(MealPlanDetail) },
                            onManualLog = { navController.navigate(MealCapture()) },
                            onPhotoLog = { uri -> navController.navigate(MealCapture(photoUri = uri, analyze = true)) },
                            onHistoryClick = { navController.navigate(MealHistory) },
                            onRecipesClick = { navController.navigate(RecipesList) },
                            onRecipeClick = { recipeId -> navController.navigate(RecipeDetail(recipeId)) },
                            onWaterClick = { navController.navigate(Hydration) }
                        )
                    }
                }

                composable<MealDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<MealDetail>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        MealDetailRoute(
                            mealId = route.mealId,
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onLogMeal = { navController.navigate(MealCapture(mealId = route.mealId)) }
                        )
                    }
                }

                composable<MealCapture> { backStackEntry ->
                    val route = backStackEntry.toRoute<MealCapture>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        MealCaptureRoute(
                            userId = currentUserId,
                            recipeId = route.recipeId,
                            mealId = route.mealId,
                            photoUri = route.photoUri,
                            analyze = route.analyze,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<MealHistory> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        MealHistoryRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onLogClick = { logId -> navController.navigate(MealHistoryDetail(logId)) }
                        )
                    }
                }

                composable<MealPlanDetail> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        MealPlanDetailRoute(
                            userId = currentUserId,
                            onMealClick = { mealId -> navController.navigate(MealDetail(mealId)) },
                            onRecordMealClick = { navController.navigate(MealCapture()) },
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<RecipesList> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        RecipesListRoute(
                            userId = currentUserId,
                            onRecipeClick = { recipeId -> navController.navigate(RecipeDetail(recipeId)) },
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<MealHistoryDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<MealHistoryDetail>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        MealHistoryDetailRoute(
                            logId = route.logId,
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<RecipeDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<RecipeDetail>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        RecipeDetailRoute(
                            recipeId = route.recipeId,
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onLogMeal = { navController.navigate(MealCapture(recipeId = route.recipeId)) }
                        )
                    }
                }

                composable<Hydration> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        HydrationRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                // ── Chat ─────────────────────────────────────────────────
                composable<Chat>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ChatHubRoute(
                            userId = currentUserId,
                            onHumanCoachClick = { navController.navigate(HumanCoachChat) },
                            onAiCoachClick = { navController.navigate(AiCoachChat) },
                            onCoachProfileClick = { navController.navigate(AboutCoach) },
                            onCheckInClick = { navController.navigate(CheckInForm(prefillExisting = false)) }
                        )
                    }
                }

                composable<HumanCoachChat> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ChatRoute(
                            userId = currentUserId,
                            chatType = ChatType.Human,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                composable<AiCoachChat> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ChatRoute(
                            userId = currentUserId,
                            chatType = ChatType.Ai,
                            onBackClick = { navController.popBackStack() }
                        )
                    }
                }

                // ── Profile ───────────────────────────────────────────────
                composable<Profile>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ProfileRoute(
                            userId = currentUserId,
                            onProgressClick = { navController.navigate(Progress) },
                            onAboutCoachClick = { navController.navigate(AboutCoach) },
                            onSettingsClick = { navController.navigate(Settings) },
                            onLogoutComplete = {
                                navController.navigate(Welcome) { popUpTo(Home) { inclusive = true } }
                            }
                        )
                    }
                }

                composable<Progress> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        ProgressRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                            onCheckInClick = { navController.navigate(CheckInForm()) },
                            onCheckInHistoryClick = { navController.navigate(CheckInHistory) },
                        )
                    }
                }

                composable<CheckInForm> { backStackEntry ->
                    val route = backStackEntry.toRoute<CheckInForm>()
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        CheckInFormRoute(
                            userId = currentUserId,
                            prefillExisting = route.prefillExisting,
                            onBackClick = { navController.popBackStack() },
                            onViewHistory = { navController.navigate(CheckInHistory) },
                        )
                    }
                }

                composable<CheckInHistory> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        CheckInHistoryRoute(
                            userId = currentUserId,
                            onBackClick = { navController.popBackStack() },
                        )
                    }
                }

                composable<AboutCoach> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) {
                        AboutCoachScreen(onBackClick = { navController.popBackStack() })
                    }
                }

                composable<Settings> {
                    RequireAuthenticatedUser(sessionState, onUnauthenticated = { navController.navigate(Welcome) { launchSingleTop = true } }) { currentUserId ->
                        SettingsRoute(
                            onBackClick = { navController.popBackStack() },
                            onLaunchOnboarding = {
                                navController.navigate(Onboarding(currentUserId))
                            },
                            onOpenGallery = { navController.navigate(Gallery) },
                            onOpenLegalDocument = { documentId -> navController.navigate(LegalDoc(documentId)) }
                        )
                    }
                }

                composable<LegalDoc> { backStackEntry ->
                    val route = backStackEntry.toRoute<LegalDoc>()
                    LegalDocumentRoute(
                        documentId = route.id,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<Gallery> {
                    GalleryScreen(onBackClick = { navController.popBackStack() })
                }
            }
        }
    }
}

@Composable
private fun RequireAuthenticatedUser(
    sessionState: SessionAuthState,
    onUnauthenticated: () -> Unit,
    content: @Composable (String) -> Unit
) {
    when (sessionState) {
        is SessionAuthState.Authenticated -> content(sessionState.user.id)
        SessionAuthState.Loading -> AuthResumeLoading()
        SessionAuthState.NotAuthenticated -> {
            LaunchedEffect(Unit) { onUnauthenticated() }
            AuthResumeLoading()
        }
    }
}

@Composable
private fun AuthResumeLoading() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

private fun NavController.navigateToBottomTab(
    tab: BottomNavTab,
    resetToRoot: Boolean = false
) {
    navigate(tab.rootRoute()) {
        popUpTo<Home> {
            saveState = !resetToRoot
        }
        launchSingleTop = true
        restoreState = !resetToRoot
    }
}

private fun NavController.navigateToBottomTabChild(
    tab: BottomNavTab,
    childRoute: Any
) {
    navigateToBottomTab(tab = tab, resetToRoot = true)
    navigate(childRoute)
}

private fun BottomNavTab.rootRoute(): Any = when (this) {
    BottomNavTab.Home -> Home
    BottomNavTab.Activity -> WorkoutList
    BottomNavTab.Coach -> Chat
    BottomNavTab.Nutrition -> MealPlan
    BottomNavTab.Profile -> Profile
}

private fun String?.toBottomNavTab(): BottomNavTab? {
    val route = this ?: return null
    return when {
        route.matchesRoute<Home>() -> BottomNavTab.Home
        route.matchesAnyRoute(
            WorkoutList::class.qualifiedName,
            WorkoutDetail::class.qualifiedName,
            ActiveSession::class.qualifiedName,
            ExerciseDetail::class.qualifiedName,
            LogWorkout::class.qualifiedName,
            ActivityTypeSelector::class.qualifiedName,
            LogActivity::class.qualifiedName,
            WorkoutHistory::class.qualifiedName,
            WorkoutHistoryDetail::class.qualifiedName,
            WorkoutPlan::class.qualifiedName,
            WorkoutEditor::class.qualifiedName,
            ExerciseLibrary::class.qualifiedName,
            ProgressDashboard::class.qualifiedName,
            PostWorkoutSummary::class.qualifiedName
        ) -> BottomNavTab.Activity
        route.matchesAnyRoute(
            Chat::class.qualifiedName,
            HumanCoachChat::class.qualifiedName,
            AiCoachChat::class.qualifiedName
        ) -> BottomNavTab.Coach
        route.matchesAnyRoute(
            MealPlan::class.qualifiedName,
            MealDetail::class.qualifiedName,
            MealCapture::class.qualifiedName,
            MealHistory::class.qualifiedName,
            MealHistoryDetail::class.qualifiedName,
            RecipeDetail::class.qualifiedName,
            MealPlanDetail::class.qualifiedName,
            RecipesList::class.qualifiedName,
            Hydration::class.qualifiedName
        ) -> BottomNavTab.Nutrition
        route.matchesAnyRoute(
            Profile::class.qualifiedName,
            Progress::class.qualifiedName,
            CheckInForm::class.qualifiedName,
            CheckInHistory::class.qualifiedName,
            AboutCoach::class.qualifiedName,
            Settings::class.qualifiedName,
            LegalDoc::class.qualifiedName,
            Gallery::class.qualifiedName
        ) -> BottomNavTab.Profile
        else -> null
    }
}

private inline fun <reified T : Any> String.matchesRoute(): Boolean =
    matchesAnyRoute(T::class.qualifiedName)

private fun String.matchesAnyRoute(vararg routeNames: String?): Boolean =
    routeNames.any { routeName -> routeName != null && contains(routeName) }
