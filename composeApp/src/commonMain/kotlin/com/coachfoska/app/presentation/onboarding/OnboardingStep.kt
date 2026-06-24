package com.coachfoska.app.presentation.onboarding

enum class OnboardingStep {
    GENDER,
    GOAL,
    EXPERIENCE,
    FOCUS_AREAS,
    VALUE_PROP_1,
    FREQUENCY,
    EQUIPMENT,
    BODY_STATS,
    VALUE_PROP_2,
    TRAINING_PREFERENCE,
    NAME,
    PLAN_LOADING;

    /** Back arrow shows on every step except the terminal plan-loading screen. */
    val showBack: Boolean
        get() = this != PLAN_LOADING
}
