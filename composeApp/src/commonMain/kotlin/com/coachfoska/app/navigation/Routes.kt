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
@Serializable data class ExerciseDetail(val exerciseId: Int)
@Serializable object LogWorkout
@Serializable object WorkoutHistory

// Nutrition
@Serializable object MealPlan
@Serializable data class MealDetail(val mealId: String)
@Serializable object MealCapture
@Serializable object MealHistory

// Profile
@Serializable object Profile
@Serializable object Progress
@Serializable object AboutCoach
