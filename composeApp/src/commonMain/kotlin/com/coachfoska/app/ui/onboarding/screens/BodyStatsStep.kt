package com.coachfoska.app.ui.onboarding.screens

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.BmiCategory
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.app.ui.onboarding.components.ScrollWheelPicker
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun BodyStatsStep(state: OnboardingState, onIntent: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val d = state.data
    val bmiCategoryLabel = when (d.bmiCategory) {
        BmiCategory.UNDERWEIGHT -> stringResource(Res.string.ob_bmi_underweight)
        BmiCategory.NORMAL -> stringResource(Res.string.ob_bmi_normal)
        BmiCategory.OVERWEIGHT -> stringResource(Res.string.ob_bmi_overweight)
        BmiCategory.OBESE -> stringResource(Res.string.ob_bmi_obese)
        BmiCategory.EXTREMELY_OBESE -> stringResource(Res.string.ob_bmi_extremely_obese)
    }
    val dotColor = when (d.bmiCategory) {
        BmiCategory.NORMAL -> DsTheme.colors.success
        BmiCategory.OVERWEIGHT -> DsTheme.colors.accent
        else -> DsTheme.colors.error
    }
    val bmiText = ((d.bmi * 10).toInt() / 10f).toString()

    Column(modifier.fillMaxSize().padding(top = DsTheme.spacing.lg, bottom = DsTheme.spacing.xl)) {
        Text(stringResource(Res.string.ob_body_title), style = MaterialTheme.typography.headlineMedium, color = DsTheme.colors.textPrimary)
        Text(stringResource(Res.string.ob_body_subtitle), style = MaterialTheme.typography.bodyMedium, color = DsTheme.colors.textSecondary, modifier = Modifier.padding(top = DsTheme.spacing.sm, bottom = DsTheme.spacing.lg))
        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(Res.string.ob_body_age), style = MaterialTheme.typography.labelMedium, color = DsTheme.colors.textSecondary)
                ScrollWheelPicker(values = (14..100).toList(), selected = d.age, onSelected = { onIntent(OnboardingIntent.SetAge(it)) }, label = { "$it" })
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(Res.string.ob_body_height), style = MaterialTheme.typography.labelMedium, color = DsTheme.colors.textSecondary)
                ScrollWheelPicker(values = (120..220).toList(), selected = d.heightCm, onSelected = { onIntent(OnboardingIntent.SetHeight(it)) }, label = { "$it cm" })
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(Res.string.ob_body_weight), style = MaterialTheme.typography.labelMedium, color = DsTheme.colors.textSecondary)
                ScrollWheelPicker(values = (40..200).toList(), selected = d.weightKg.toInt(), onSelected = { onIntent(OnboardingIntent.SetWeight(it.toFloat())) }, label = { "$it kg" })
            }
        }
        Row(Modifier.padding(vertical = DsTheme.spacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(RectangleShape).background(dotColor))
            Text(
                "  ${stringResource(Res.string.ob_bmi_label)}: $bmiText — $bmiCategoryLabel",
                style = MaterialTheme.typography.bodyMedium,
                color = DsTheme.colors.textPrimary
            )
        }
        DsButton(text = stringResource(Res.string.ob_continue), onClick = { onIntent(OnboardingIntent.NextStep) }, shape = RectangleShape, modifier = Modifier.fillMaxWidth())
    }
}
