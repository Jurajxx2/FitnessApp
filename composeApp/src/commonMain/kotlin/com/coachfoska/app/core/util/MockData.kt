package com.coachfoska.app.core.util

import com.coachfoska.app.domain.model.*
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate

object MockData {
    val recipes = listOf(
        Recipe(
            id = "1",
            name = "Oatmeal with Berries",
            description = "A healthy start to your day with complex carbs and antioxidants.",
            ingredients = listOf("50g Oats", "100ml Almond milk", "50g Blueberries", "10g Honey"),
            instructions = listOf("Boil oats with milk", "Top with berries and honey"),
            calories = 350f,
            protein = 12f,
            carbs = 60f,
            fat = 6f,
            prepTimeMinutes = 10
        ),
        Recipe(
            id = "2",
            name = "Grilled Chicken Salad",
            description = "High protein meal with fresh greens.",
            ingredients = listOf("150g Chicken breast", "100g Mixed greens", "50g Cherry tomatoes", "1tbsp Olive oil"),
            instructions = listOf("Grill chicken until golden", "Mix with greens and dressing"),
            calories = 450f,
            protein = 40f,
            carbs = 10f,
            fat = 18f,
            prepTimeMinutes = 20
        ),
        Recipe(
            id = "3",
            name = "Protein Pancakes",
            description = "The ultimate guilt-free treat.",
            ingredients = listOf("1 scoop Whey protein", "1 Egg", "1 Banana"),
            instructions = listOf("Mash banana", "Mix with egg and protein", "Fry on non-stick pan"),
            calories = 320f,
            protein = 30f,
            carbs = 25f,
            fat = 8f,
            prepTimeMinutes = 15
        )
    )

    val mealPlan = MealPlan(
        id = "plan_1",
        name = "High Performance Plan",
        description = "Optimized for muscle growth and recovery.",
        meals = listOf(
            Meal(
                id = "m1", mealPlanId = "plan_1", name = "Breakfast", timeOfDay = "08:00", sortOrder = 0,
                foods = listOf(MealFood("f1", "m1", "Oatmeal", 50f, 350f, 12f, 60f, 6f))
            ),
            Meal(
                id = "m2", mealPlanId = "plan_1", name = "Lunch", timeOfDay = "13:00", sortOrder = 1,
                foods = listOf(MealFood("f2", "m2", "Chicken & Rice", 200f, 550f, 45f, 70f, 10f))
            ),
            Meal(
                id = "m3", mealPlanId = "plan_1", name = "Dinner", timeOfDay = "19:00", sortOrder = 2,
                foods = listOf(MealFood("f3", "m3", "Salmon & Broccoli", 150f, 400f, 35f, 5f, 25f))
            )
        ),
        validFrom = null,
        validTo = null
    )

    val workoutPlan = listOf(
        Workout(
            id = "w1",
            name = "Push Day A",
            dayOfWeek = DayOfWeek.MONDAY,
            durationMinutes = 60,
            exercises = listOf(
                WorkoutExercise("we1", "w1", "Bench Press", "Chest", 4, "8-10", 90, "Focus on form", null, 0),
                WorkoutExercise("we2", "w1", "Overhead Press", "Shoulders", 3, "10-12", 60, "Keep core tight", null, 1),
                WorkoutExercise("we3", "w1", "Tricep Pushdowns", "Triceps", 3, "12-15", 45, "Full extension", null, 2)
            ),
            notes = "Focus on explosive concentric phase."
        ),
        Workout(
            id = "w2",
            name = "Pull Day A",
            dayOfWeek = DayOfWeek.WEDNESDAY,
            durationMinutes = 65,
            exercises = listOf(
                WorkoutExercise("we4", "w2", "Deadlifts", "Back", 3, "5", 180, "Neutral spine", null, 0),
                WorkoutExercise("we5", "w2", "Pull Ups", "Back", 3, "Max", 90, "Controlled descent", null, 1),
                WorkoutExercise("we6", "w2", "Bicep Curls", "Biceps", 3, "12", 60, "No swinging", null, 2)
            ),
            notes = "Maintain grip strength."
        )
    )
}
