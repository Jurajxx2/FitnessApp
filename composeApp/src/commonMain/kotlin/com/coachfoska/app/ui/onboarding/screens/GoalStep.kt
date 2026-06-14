package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.onboarding.components.SingleSelectStep
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun GoalStep(state: OnboardingState, onSelectAdvance: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val titles = mapOf(
        FitnessGoal.BUILD_MUSCLE to stringResource(Res.string.ob_goal_build_muscle),
        FitnessGoal.LOSE_WEIGHT to stringResource(Res.string.ob_goal_lose_weight),
        FitnessGoal.STAY_FIT to stringResource(Res.string.ob_goal_stay_fit),
        FitnessGoal.GET_STRONGER to stringResource(Res.string.ob_goal_get_stronger)
    )
    val descs = mapOf(
        FitnessGoal.BUILD_MUSCLE to stringResource(Res.string.ob_goal_build_muscle_desc),
        FitnessGoal.LOSE_WEIGHT to stringResource(Res.string.ob_goal_lose_weight_desc),
        FitnessGoal.STAY_FIT to stringResource(Res.string.ob_goal_stay_fit_desc),
        FitnessGoal.GET_STRONGER to stringResource(Res.string.ob_goal_get_stronger_desc)
    )
    SingleSelectStep(
        title = stringResource(Res.string.ob_goal_title),
        subtitle = stringResource(Res.string.ob_goal_subtitle),
        options = listOf(FitnessGoal.BUILD_MUSCLE, FitnessGoal.LOSE_WEIGHT, FitnessGoal.STAY_FIT, FitnessGoal.GET_STRONGER),
        selected = state.data.goal,
        onSelect = { onSelectAdvance(OnboardingIntent.SelectGoal(it)) },
        modifier = modifier
    ) { goal ->
        Column {
            Text(titles.getValue(goal), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
            Text(descs.getValue(goal), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
