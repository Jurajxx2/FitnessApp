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

    /** Chrome (progress bar + back arrow) is hidden on hero/value-prop/loading screens. */
    val showChrome: Boolean
        get() = this !in setOf(VALUE_PROP_1, VALUE_PROP_2, PLAN_LOADING)

    /** Back arrow shows on every step except the terminal plan-loading screen. */
    val showBack: Boolean
        get() = this != PLAN_LOADING
}
