package com.coachfoska.app

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.coachfoska.app.core.theme.ThemeRepository
import org.koin.compose.koinInject
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.navigation.*
import com.coachfoska.app.theme.CoachFoskaTheme
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.stringResource
import com.coachfoska.app.ui.auth.EmailOtpRoute
import com.coachfoska.app.ui.auth.VerifyOtpRoute
import com.coachfoska.app.ui.auth.WelcomeRoute
import com.coachfoska.app.ui.components.BottomNavBar
import com.coachfoska.app.ui.components.BottomNavTab
import com.coachfoska.app.ui.home.HomeRoute
import com.coachfoska.app.ui.nutrition.MealCaptureRoute
import com.coachfoska.app.ui.nutrition.MealDetailRoute
import com.coachfoska.app.ui.nutrition.MealHistoryRoute
import com.coachfoska.app.ui.nutrition.MealPlanRoute
import com.coachfoska.app.ui.onboarding.OnboardingRoute
import com.coachfoska.app.ui.chat.ChatHubRoute
import com.coachfoska.app.ui.chat.ChatRoute
import com.coachfoska.app.ui.profile.AboutCoachScreen
import com.coachfoska.app.ui.profile.ProfileRoute
import com.coachfoska.app.ui.profile.ProgressRoute
import com.coachfoska.app.ui.splash.SplashRoute
import com.coachfoska.app.ui.workout.ExerciseByCategoryRoute
import com.coachfoska.app.ui.workout.ExerciseDetailRoute
import com.coachfoska.app.ui.workout.LogWorkoutRoute
import com.coachfoska.app.ui.workout.WorkoutDetailRoute
import com.coachfoska.app.ui.workout.WorkoutHistoryRoute
import com.coachfoska.app.ui.workout.WorkoutHistoryDetailRoute
import com.coachfoska.app.ui.workout.WorkoutListRoute

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App() {
    val themeRepository = koinInject<ThemeRepository>()
    val isDarkTheme by themeRepository.isDarkTheme.collectAsState()

    CoachFoskaTheme(darkTheme = isDarkTheme) {
        val navController = rememberNavController()
        var currentUserId by remember { mutableStateOf("") }

        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route

        val authRoutes = listOf(
            Splash::class.qualifiedName,
            Welcome::class.qualifiedName,
            EmailOtp::class.qualifiedName,
            VerifyOtp::class.qualifiedName,
            Onboarding::class.qualifiedName
        )
        val bottomTabRoutes = listOf(
            Home::class.qualifiedName,
            WorkoutList::class.qualifiedName,
            Chat::class.qualifiedName,
            MealPlan::class.qualifiedName,
            Profile::class.qualifiedName
        )
        val showBottomBar = currentRoute != null &&
            authRoutes.none { currentRoute.contains(it ?: "") }

        val showTopBar = currentRoute != null &&
            authRoutes.none { currentRoute.contains(it ?: "") } &&
            bottomTabRoutes.none { currentRoute.contains(it ?: "") }

        val aboutFoskaTitle = stringResource(Res.string.about_foska)

        val topBarTitle by remember(currentRoute, aboutFoskaTitle) {
            derivedStateOf {
                when {
                    currentRoute?.contains("ExercisesByCategory") == true ->
                        runCatching {
                            navBackStackEntry?.toRoute<ExercisesByCategory>()?.categoryName?.uppercase()
                        }.getOrNull() ?: "EXERCISES"
                    currentRoute?.contains("WorkoutHistoryDetail") == true -> "SESSION DETAIL"
                    currentRoute?.contains("WorkoutHistory") == true -> "WORKOUT HISTORY"
                    currentRoute?.contains("WorkoutDetail") == true -> "WORKOUT"
                    currentRoute?.contains("ExerciseDetail") == true -> "EXERCISE"
                    currentRoute?.contains("LogWorkout") == true -> "LOG SESSION"
                    currentRoute?.contains("HumanCoachChat") == true -> "COACH"
                    currentRoute?.contains("AiCoachChat") == true -> "AI COACH"
                    currentRoute?.contains("MealCapture") == true -> "RECORD MEAL"
                    currentRoute?.contains("MealHistory") == true -> "MEAL HISTORY"
                    currentRoute?.contains("MealDetail") == true -> "MEAL DETAIL"
                    currentRoute?.contains("Progress") == true -> "MY PROGRESS"
                    currentRoute?.contains("AboutCoach") == true -> aboutFoskaTitle
                    else -> ""
                }
            }
        }

        val selectedTab by remember(currentRoute) {
            derivedStateOf {
                when {
                    currentRoute?.contains("Home") == true -> BottomNavTab.Home
                    currentRoute?.contains("Workout", ignoreCase = true) == true ||
                        currentRoute?.contains("Exercise", ignoreCase = true) == true -> BottomNavTab.Workout
                    currentRoute?.contains("Chat", ignoreCase = true) == true ||
                        currentRoute?.contains("CoachChat") == true -> BottomNavTab.Chat
                    currentRoute?.contains("Meal", ignoreCase = true) == true ||
                        currentRoute?.contains("Nutrition", ignoreCase = true) == true -> BottomNavTab.Nutrition
                    currentRoute?.contains("Profile", ignoreCase = true) == true ||
                        currentRoute?.contains("Progress") == true ||
                        currentRoute?.contains("AboutCoach") == true -> BottomNavTab.Profile
                    else -> BottomNavTab.Home
                }
            }
        }

        Scaffold(
            topBar = {
                if (showTopBar) {
                    TopAppBar(
                        title = {
                            Text(
                                text = topBarTitle,
                                style = MaterialTheme.typography.labelLarge,
                                letterSpacing = 1.sp
                            )
                        },
                        navigationIcon = {
                            IconButton(onClick = { navController.popBackStack() }) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.background,
                            navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                            titleContentColor = MaterialTheme.colorScheme.onBackground
                        )
                    )
                }
            },
            bottomBar = {
                if (showBottomBar) {
                    BottomNavBar(
                        selectedTab = selectedTab,
                        onTabSelected = { tab ->
                            val route: Any = when (tab) {
                                BottomNavTab.Home -> Home
                                BottomNavTab.Workout -> WorkoutList
                                BottomNavTab.Chat -> Chat
                                BottomNavTab.Nutrition -> MealPlan
                                BottomNavTab.Profile -> Profile
                            }
                            navController.navigate(route) {
                                popUpTo<Home> { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
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
                        onNavigateToHome = { userId ->
                            currentUserId = userId
                            navController.navigate(Home) { popUpTo<Splash> { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            currentUserId = userId
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
                        onNavigateToHome = { userId ->
                            currentUserId = userId
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            currentUserId = userId
                            navController.navigate(Onboarding(userId)) { popUpTo(Welcome) { inclusive = true } }
                        }
                    )
                }

                composable<EmailOtp> {
                    EmailOtpRoute(
                        onBackClick = { navController.popBackStack() },
                        onOtpSent = { email -> navController.navigate(VerifyOtp(email)) }
                    )
                }

                composable<VerifyOtp> { backStackEntry ->
                    val route = backStackEntry.toRoute<VerifyOtp>()
                    VerifyOtpRoute(
                        email = route.email,
                        onBackClick = { navController.popBackStack() },
                        onNavigateToHome = { userId ->
                            currentUserId = userId
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = { userId ->
                            currentUserId = userId
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
                        }
                    )
                }

                // ── Home ──────────────────────────────────────────────────
                composable<Home>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    HomeRoute(
                        userId = currentUserId,
                        onChatClick = { navController.navigate(HumanCoachChat) }
                    )
                }

                // ── Workout ───────────────────────────────────────────────
                composable<WorkoutList>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    WorkoutListRoute(
                        userId = currentUserId,
                        onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
                        onLogWorkoutClick = { navController.navigate(LogWorkout) },
                        onCategoryClick = { categoryId, categoryName ->
                            navController.navigate(ExercisesByCategory(categoryId, categoryName))
                        },
                        onHistoryItemClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) }
                    )
                }

                composable<WorkoutDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<WorkoutDetail>()
                    WorkoutDetailRoute(
                        workoutId = route.workoutId,
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() },
                        onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) }
                    )
                }

                composable<ExerciseDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<ExerciseDetail>()
                    ExerciseDetailRoute(
                        exerciseId = route.exerciseId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<ExercisesByCategory> { backStackEntry ->
                    val route = backStackEntry.toRoute<ExercisesByCategory>()
                    ExerciseByCategoryRoute(
                        categoryId = route.categoryId,
                        categoryName = route.categoryName,
                        onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) },
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<LogWorkout> {
                    LogWorkoutRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<WorkoutHistory> {
                    WorkoutHistoryRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() },
                        onLogClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) }
                    )
                }

                composable<WorkoutHistoryDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<WorkoutHistoryDetail>()
                    WorkoutHistoryDetailRoute(
                        logId = route.logId,
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                // ── Nutrition ─────────────────────────────────────────────
                composable<MealPlan>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    MealPlanRoute(
                        userId = currentUserId,
                        onMealClick = { mealId -> navController.navigate(MealDetail(mealId)) },
                        onRecordMealClick = { navController.navigate(MealCapture) },
                        onRecipeClick = { recipeId -> navController.navigate(MealDetail(recipeId)) } // Using MealDetail for recipes for now
                    )
                }

                composable<MealDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<MealDetail>()
                    MealDetailRoute(
                        mealId = route.mealId,
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<MealCapture> {
                    MealCaptureRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<MealHistory> {
                    MealHistoryRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                // ── Chat ─────────────────────────────────────────────────
                composable<Chat>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    ChatHubRoute(
                        userId = currentUserId,
                        onHumanCoachClick = { navController.navigate(HumanCoachChat) },
                        onAiCoachClick = { navController.navigate(AiCoachChat) }
                    )
                }

                composable<HumanCoachChat> {
                    ChatRoute(
                        userId = currentUserId,
                        chatType = ChatType.Human
                    )
                }

                composable<AiCoachChat> {
                    ChatRoute(
                        userId = currentUserId,
                        chatType = ChatType.Ai
                    )
                }

                // ── Profile ───────────────────────────────────────────────
                composable<Profile>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    ProfileRoute(
                        userId = currentUserId,
                        onProgressClick = { navController.navigate(Progress) },
                        onAboutCoachClick = { navController.navigate(AboutCoach) },
                        onLogoutComplete = {
                            currentUserId = ""
                            navController.navigate(Welcome) { popUpTo(Home) { inclusive = true } }
                        }
                    )
                }

                composable<Progress> {
                    ProgressRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<AboutCoach> {
                    AboutCoachScreen(onBackClick = { navController.popBackStack() })
                }
            }
        }
    }
}
