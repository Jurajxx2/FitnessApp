package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.ob_back_cd

/**
 * Persistent onboarding chrome, rendered once by [OnboardingRoute] above the step content.
 * The progress bar always shows; the back button shows only when [showBack] is true.
 */
@Composable
fun OnboardingTopBar(
    progress: Float,
    showBack: Boolean,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier.fillMaxWidth()) {
        OnboardingProgressBar(progress)
        if (showBack) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(Res.string.ob_back_cd),
                    tint = MaterialTheme.colorScheme.onBackground
                )
            }
        }
    }
}
