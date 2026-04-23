package com.coachfoska.app.navigation

import kotlinx.serialization.Serializable

// Splash — app entry point, resolves session before showing any screen
@Serializable object Splash

// Auth flow
@Serializable object Welcome
@Serializable object EmailOtp
@Serializable data class VerifyOtp(val email: String)

// Onboarding — handled as a single destination with internal step navigation
@Serializable data class Onboarding(val userId: String)

// Main app
@Serializable object Home

// Workout
@Serializable object WorkoutList
@Serializable data class WorkoutDetail(val workoutId: String)
@Serializable data class ExerciseDetail(val exerciseId: String)
@Serializable data class ExercisesByCategory(val categoryId: Int, val categoryName: String)
@Serializable object LogWorkout
@Serializable object WorkoutHistory
@Serializable data class WorkoutHistoryDetail(val logId: String)
@Serializable object WorkoutPlan
@Serializable object ExerciseLibrary

// Nutrition
@Serializable object MealPlan
@Serializable data class MealDetail(val mealId: String)
@Serializable object MealCapture
@Serializable object MealHistory
@Serializable data class MealHistoryDetail(val logId: String)
@Serializable data class RecipeDetail(val recipeId: String)
@Serializable object MealPlanDetail
@Serializable object RecipesList

// Chat
@Serializable object Chat
@Serializable object HumanCoachChat
@Serializable object AiCoachChat

// Profile
@Serializable object Profile
@Serializable object Progress
@Serializable object AboutCoach
