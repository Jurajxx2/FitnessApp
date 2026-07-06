package com.coachfoska.app.ui.onboarding.screens

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.components.DsButton
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun ValueProp2Step(onContinue: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().padding(DsTheme.spacing.xl), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.weight(1f))
        Text(stringResource(Res.string.ob_valueprop2_title), style = MaterialTheme.typography.displaySmall, color = DsTheme.colors.textPrimary, textAlign = TextAlign.Center)
        Text(stringResource(Res.string.ob_valueprop2_subtitle), style = MaterialTheme.typography.bodyLarge, color = DsTheme.colors.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.padding(top = DsTheme.spacing.md))
        Spacer(Modifier.weight(1f))
        DsButton(text = stringResource(Res.string.ob_continue), onClick = onContinue, shape = RectangleShape)
    }
}
