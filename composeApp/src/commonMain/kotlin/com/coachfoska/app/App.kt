package com.coachfoska.app

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.coachfoska.app.navigation.*
import com.coachfoska.app.theme.CoachFoskaTheme
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

@Composable
fun App() {
    CoachFoskaTheme {
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
        val showBottomBar = currentRoute != null &&
            authRoutes.none { currentRoute.contains(it ?: "") }

        val selectedTab by remember(currentRoute) {
            derivedStateOf {
                when {
                    currentRoute?.contains("Home") == true -> BottomNavTab.Home
                    currentRoute?.contains("Workout", ignoreCase = true) == true ||
                        currentRoute?.contains("Exercise", ignoreCase = true) == true -> BottomNavTab.Workout
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
            bottomBar = {
                if (showBottomBar) {
                    BottomNavBar(
                        selectedTab = selectedTab,
                        onTabSelected = { tab ->
                            val route: Any = when (tab) {
                                BottomNavTab.Home -> Home
                                BottomNavTab.Workout -> WorkoutList
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
                modifier = if (showBottomBar) Modifier.padding(innerPadding) else Modifier,
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
                    HomeRoute(userId = currentUserId)
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
                        onMealHistoryClick = { navController.navigate(MealHistory) }
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
