package com.coachfoska.app.ui.onboarding.screens

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
import com.coachfoska.app.theme.BrandRed
import com.coachfoska.app.theme.Error
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.theme.Success
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
        BmiCategory.NORMAL -> Success
        BmiCategory.OVERWEIGHT -> BrandRed
        else -> Error
    }
    val bmiText = ((d.bmi * 10).toInt() / 10f).toString()

    Column(modifier.fillMaxSize().padding(top = Spacing.lg, bottom = Spacing.xl)) {
        Text(stringResource(Res.string.ob_body_title), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onBackground)
        Text(stringResource(Res.string.ob_body_subtitle), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = Spacing.sm, bottom = Spacing.lg))
        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(Res.string.ob_body_age), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ScrollWheelPicker(values = (14..100).toList(), selected = d.age, onSelected = { onIntent(OnboardingIntent.SetAge(it)) }, label = { "$it" })
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(Res.string.ob_body_height), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ScrollWheelPicker(values = (120..220).toList(), selected = d.heightCm, onSelected = { onIntent(OnboardingIntent.SetHeight(it)) }, label = { "$it cm" })
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(Res.string.ob_body_weight), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ScrollWheelPicker(values = (40..200).toList(), selected = d.weightKg.toInt(), onSelected = { onIntent(OnboardingIntent.SetWeight(it.toFloat())) }, label = { "$it kg" })
            }
        }
        Row(Modifier.padding(vertical = Spacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(RectangleShape).background(dotColor))
            Text(
                "  ${stringResource(Res.string.ob_bmi_label)}: $bmiText — $bmiCategoryLabel",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        DsButton(text = stringResource(Res.string.ob_continue), onClick = { onIntent(OnboardingIntent.NextStep) }, shape = RectangleShape, modifier = Modifier.fillMaxWidth())
    }
}
