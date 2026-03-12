package com.coachfoska.app

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
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.navigation.*
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.presentation.home.HomeViewModel
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import com.coachfoska.app.presentation.profile.ProfileViewModel
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.theme.CoachFoskaTheme
import com.coachfoska.app.ui.auth.EmailOtpScreen
import com.coachfoska.app.ui.auth.VerifyOtpScreen
import com.coachfoska.app.ui.auth.WelcomeScreen
import com.coachfoska.app.ui.components.BottomNavBar
import com.coachfoska.app.ui.components.BottomNavTab
import com.coachfoska.app.ui.home.HomeScreen
import com.coachfoska.app.ui.nutrition.MealCaptureScreen
import com.coachfoska.app.ui.nutrition.MealDetailScreen
import com.coachfoska.app.ui.nutrition.MealHistoryScreen
import com.coachfoska.app.ui.nutrition.MealPlanScreen
import com.coachfoska.app.ui.onboarding.OnboardingFlow
import com.coachfoska.app.ui.profile.AboutCoachScreen
import com.coachfoska.app.ui.profile.ProfileScreen
import com.coachfoska.app.ui.profile.ProgressScreen
import com.coachfoska.app.ui.workout.ExerciseDetailScreen
import com.coachfoska.app.ui.workout.LogWorkoutScreen
import com.coachfoska.app.ui.workout.WorkoutDetailScreen
import com.coachfoska.app.ui.workout.WorkoutHistoryScreen
import com.coachfoska.app.ui.workout.WorkoutListScreen
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun App() {
    CoachFoskaTheme {
        val navController = rememberNavController()

        // Track authenticated user across the session
        var currentUser by remember { mutableStateOf<User?>(null) }

        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route

        val authRoutes = listOf(
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
                                popUpTo<Home> {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        ) { innerPadding ->
            // Shared AuthViewModel for all auth screens
            val authViewModel: AuthViewModel = koinViewModel()

            NavHost(
                navController = navController,
                startDestination = Welcome,
                modifier = if (showBottomBar) Modifier.padding(innerPadding) else Modifier,
                enterTransition = { slideInHorizontally { it } },
                exitTransition = { slideOutHorizontally { -it } },
                popEnterTransition = { slideInHorizontally { -it } },
                popExitTransition = { slideOutHorizontally { it } }
            ) {
                // ── Auth flow ─────────────────────────────────────────────
                composable<Welcome> {
                    WelcomeScreen(
                        authViewModel = authViewModel,
                        onNavigateToEmailOtp = { navController.navigate(EmailOtp) },
                        onNavigateToHome = {
                            currentUser = authViewModel.state.value.authenticatedUser
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = {
                            val user = authViewModel.state.value.authenticatedUser
                            currentUser = user
                            navController.navigate(Onboarding(user?.id ?: "")) {
                                popUpTo(Welcome) { inclusive = true }
                            }
                        }
                    )
                }

                composable<EmailOtp> {
                    EmailOtpScreen(
                        authViewModel = authViewModel,
                        onBackClick = { navController.popBackStack() },
                        onOtpSent = { navController.navigate(VerifyOtp) }
                    )
                }

                composable<VerifyOtp> {
                    VerifyOtpScreen(
                        authViewModel = authViewModel,
                        onBackClick = { navController.popBackStack() },
                        onNavigateToHome = {
                            currentUser = authViewModel.state.value.authenticatedUser
                            navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                        },
                        onNavigateToOnboarding = {
                            val user = authViewModel.state.value.authenticatedUser
                            currentUser = user
                            navController.navigate(Onboarding(user?.id ?: "")) {
                                popUpTo(Welcome) { inclusive = true }
                            }
                        }
                    )
                }

                // ── Onboarding ────────────────────────────────────────────
                composable<Onboarding> { backStackEntry ->
                    val route = backStackEntry.toRoute<Onboarding>()
                    val onboardingViewModel: OnboardingViewModel = koinViewModel { parametersOf(route.userId) }
                    OnboardingFlow(
                        viewModel = onboardingViewModel,
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
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val homeViewModel: HomeViewModel = koinViewModel { parametersOf(userId) }
                    HomeScreen(homeViewModel = homeViewModel)
                }

                // ── Workout ───────────────────────────────────────────────
                composable<WorkoutList>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val workoutViewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
                    WorkoutListScreen(
                        workoutViewModel = workoutViewModel,
                        onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
                        onLogWorkoutClick = { navController.navigate(LogWorkout) },
                        onWorkoutHistoryClick = { navController.navigate(WorkoutHistory) }
                    )
                }

                composable<WorkoutDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<WorkoutDetail>()
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val workoutViewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
                    WorkoutDetailScreen(
                        workoutViewModel = workoutViewModel,
                        workoutId = route.workoutId,
                        onBackClick = { navController.popBackStack() },
                        onExerciseClick = { exerciseId -> navController.navigate(ExerciseDetail(exerciseId)) }
                    )
                }

                composable<ExerciseDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<ExerciseDetail>()
                    val exerciseViewModel: ExerciseViewModel = koinViewModel()
                    ExerciseDetailScreen(
                        exerciseViewModel = exerciseViewModel,
                        exerciseId = route.exerciseId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<LogWorkout> {
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val workoutViewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
                    LogWorkoutScreen(
                        workoutViewModel = workoutViewModel,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<WorkoutHistory> {
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val workoutViewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
                    WorkoutHistoryScreen(
                        workoutViewModel = workoutViewModel,
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
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val nutritionViewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
                    MealPlanScreen(
                        nutritionViewModel = nutritionViewModel,
                        onMealClick = { mealId -> navController.navigate(MealDetail(mealId)) },
                        onRecordMealClick = { navController.navigate(MealCapture) },
                        onMealHistoryClick = { navController.navigate(MealHistory) }
                    )
                }

                composable<MealDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<MealDetail>()
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val nutritionViewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
                    MealDetailScreen(
                        nutritionViewModel = nutritionViewModel,
                        mealId = route.mealId,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<MealCapture> {
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val nutritionViewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
                    MealCaptureScreen(
                        nutritionViewModel = nutritionViewModel,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable<MealHistory> {
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val nutritionViewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
                    MealHistoryScreen(
                        nutritionViewModel = nutritionViewModel,
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
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val profileViewModel: ProfileViewModel = koinViewModel { parametersOf(userId) }
                    ProfileScreen(
                        profileViewModel = profileViewModel,
                        onProgressClick = { navController.navigate(Progress) },
                        onAboutCoachClick = { navController.navigate(AboutCoach) },
                        onLogoutComplete = {
                            currentUser = null
                            navController.navigate(Welcome) {
                                popUpTo(Home) { inclusive = true }
                            }
                        }
                    )
                }

                composable<Progress> {
                    val userId = currentUser?.id ?: authViewModel.state.value.authenticatedUser?.id ?: ""
                    val profileViewModel: ProfileViewModel = koinViewModel { parametersOf(userId) }
                    ProgressScreen(
                        profileViewModel = profileViewModel,
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
