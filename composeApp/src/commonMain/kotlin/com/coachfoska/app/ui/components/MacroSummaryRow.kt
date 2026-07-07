package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.designsystem.theme.DsTheme
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.macro_kcal
import coachfoska.composeapp.generated.resources.macro_protein
import coachfoska.composeapp.generated.resources.macro_carbs
import coachfoska.composeapp.generated.resources.macro_fat
import org.jetbrains.compose.resources.stringResource

@Composable
fun MacroSummaryRow(
    summary: DailyNutritionSummary,
    targets: MacroTargets?,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth()) {
        MacroItem(stringResource(Res.string.macro_kcal), summary.calories, targets?.calories, modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_protein), summary.proteinG, targets?.proteinG, suffix = "g", modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_carbs), summary.carbsG, targets?.carbsG, suffix = "g", modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_fat), summary.fatG, targets?.fatG, suffix = "g", modifier = Modifier.weight(1f))
    }
}

@Composable
private fun MacroItem(
    label: String,
    value: Float,
    target: Float?,
    suffix: String = "",
    modifier: Modifier = Modifier,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier.padding(horizontal = 4.dp)) {
        Text(
            text = "${value.toInt()}$suffix",
            style = MaterialTheme.typography.headlineMedium,
            color = DsTheme.colors.textPrimary
        )
        if (target != null && target > 0f) {
            Text(
                text = "/ ${target.toInt()}$suffix",
                style = MaterialTheme.typography.labelSmall,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.4f)
            )
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (value / target).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(50)),
                color = DsTheme.colors.actionPrimary,
                trackColor = DsTheme.colors.textPrimary.copy(alpha = 0.08f)
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
    }
}
