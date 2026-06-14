package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.ob_back_cd

/**
 * Standard onboarding chrome. [showChrome] hides progress + back on hero/value-prop/loading steps.
 * [content] receives a Modifier already padded for the screen body.
 */
@Composable
fun OnboardingScaffold(
    showChrome: Boolean,
    progress: Float,
    onBack: () -> Unit,
    content: @Composable (Modifier) -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        if (showChrome) {
            OnboardingProgressBar(progress)
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(Res.string.ob_back_cd),
                    tint = MaterialTheme.colorScheme.onBackground
                )
            }
        }
        Box(Modifier.fillMaxSize()) {
            content(Modifier.padding(horizontal = 24.dp))
        }
    }
}
