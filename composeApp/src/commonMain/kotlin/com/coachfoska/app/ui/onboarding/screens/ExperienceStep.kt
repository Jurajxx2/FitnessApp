package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.coachfoska.app.domain.model.ExperienceLevel
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.onboarding.components.LevelBars
import com.coachfoska.app.ui.onboarding.components.SingleSelectStep
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun ExperienceStep(state: OnboardingState, onSelectAdvance: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val titles = mapOf(
        ExperienceLevel.BEGINNER to stringResource(Res.string.ob_experience_beginner),
        ExperienceLevel.INTERMEDIATE to stringResource(Res.string.ob_experience_intermediate),
        ExperienceLevel.ADVANCED to stringResource(Res.string.ob_experience_advanced),
        ExperienceLevel.EXPERT to stringResource(Res.string.ob_experience_expert)
    )
    val descs = mapOf(
        ExperienceLevel.BEGINNER to stringResource(Res.string.ob_experience_beginner_desc),
        ExperienceLevel.INTERMEDIATE to stringResource(Res.string.ob_experience_intermediate_desc),
        ExperienceLevel.ADVANCED to stringResource(Res.string.ob_experience_advanced_desc),
        ExperienceLevel.EXPERT to stringResource(Res.string.ob_experience_expert_desc)
    )
    SingleSelectStep(
        title = stringResource(Res.string.ob_experience_title),
        subtitle = stringResource(Res.string.ob_experience_subtitle),
        options = listOf(ExperienceLevel.BEGINNER, ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED, ExperienceLevel.EXPERT),
        selected = state.data.experienceLevel,
        onSelect = { onSelectAdvance(OnboardingIntent.SelectExperience(it)) },
        modifier = modifier
    ) { level ->
        Column(Modifier.weight(1f)) {
            Text(titles.getValue(level), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
            Text(descs.getValue(level), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LevelBars(filled = level.bars)
    }
}
