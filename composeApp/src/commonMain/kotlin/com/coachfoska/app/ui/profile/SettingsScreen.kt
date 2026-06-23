package com.coachfoska.app.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.configure_url_first
import coachfoska.composeapp.generated.resources.debug_launch_onboarding
import coachfoska.composeapp.generated.resources.debug_launch_onboarding_desc
import coachfoska.composeapp.generated.resources.debug_reset_onboarding
import coachfoska.composeapp.generated.resources.debug_reset_onboarding_desc
import coachfoska.composeapp.generated.resources.debug_reset_onboarding_success
import coachfoska.composeapp.generated.resources.delete_account
import coachfoska.composeapp.generated.resources.delete_account_desc
import coachfoska.composeapp.generated.resources.export_my_data
import coachfoska.composeapp.generated.resources.export_my_data_desc
import coachfoska.composeapp.generated.resources.privacy_policy
import coachfoska.composeapp.generated.resources.settings_about
import coachfoska.composeapp.generated.resources.settings_about_desc
import coachfoska.composeapp.generated.resources.settings_appearance
import coachfoska.composeapp.generated.resources.settings_appearance_desc
import coachfoska.composeapp.generated.resources.settings_debug
import coachfoska.composeapp.generated.resources.settings_notifications
import coachfoska.composeapp.generated.resources.settings_notifications_desc
import coachfoska.composeapp.generated.resources.settings_privacy_data
import coachfoska.composeapp.generated.resources.settings_profile
import coachfoska.composeapp.generated.resources.settings_profile_desc
import coachfoska.composeapp.generated.resources.settings_title
import coachfoska.composeapp.generated.resources.settings_units
import coachfoska.composeapp.generated.resources.settings_units_desc
import coachfoska.composeapp.generated.resources.store_compliance_ready
import coachfoska.composeapp.generated.resources.terms_of_service
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.settings.SettingsViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun SettingsRoute(
    onBackClick: () -> Unit,
    onLaunchOnboarding: () -> Unit,
    viewModel: SettingsViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SettingsScreen(
        privacyPolicyUrl = state.privacyPolicyUrl,
        termsOfServiceUrl = state.termsOfServiceUrl,
        accountDeletionUrl = state.accountDeletionUrl,
        debugResetOnboardingLoading = state.debugResetOnboardingLoading,
        debugResetOnboardingSuccess = state.debugResetOnboardingSuccess,
        debugError = state.error,
        onDebugResetOnboarding = viewModel::debugResetOnboarding,
        onDebugLaunchOnboarding = onLaunchOnboarding,
        onBackClick = onBackClick
    )
}

@Composable
fun SettingsScreen(
    privacyPolicyUrl: String,
    termsOfServiceUrl: String,
    accountDeletionUrl: String,
    debugResetOnboardingLoading: Boolean = false,
    debugResetOnboardingSuccess: Boolean = false,
    debugError: String? = null,
    onDebugResetOnboarding: () -> Unit = {},
    onDebugLaunchOnboarding: () -> Unit = {},
    onBackClick: () -> Unit
) {
    val uriHandler = LocalUriHandler.current
    var notice by remember { mutableStateOf<String?>(null) }
    val configureUrlFirst = stringResource(Res.string.configure_url_first)
    val complianceReady = stringResource(Res.string.store_compliance_ready)

    fun openConfiguredUrl(url: String) {
        if (url.isBlank()) {
            notice = configureUrlFirst
        } else {
            uriHandler.openUri(url)
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(Res.string.settings_title),
                    style = MaterialTheme.typography.displaySmall,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = complianceReady,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f),
                    lineHeight = 20.sp
                )
            }

            SettingsSection {
                SettingsRow(
                    title = stringResource(Res.string.settings_profile),
                    description = stringResource(Res.string.settings_profile_desc),
                    enabled = false
                )
                SettingsDivider()
                SettingsRow(
                    title = stringResource(Res.string.settings_units),
                    description = stringResource(Res.string.settings_units_desc),
                    enabled = false
                )
                SettingsDivider()
                SettingsRow(
                    title = stringResource(Res.string.settings_notifications),
                    description = stringResource(Res.string.settings_notifications_desc),
                    enabled = false
                )
                SettingsDivider()
                SettingsRow(
                    title = stringResource(Res.string.settings_appearance),
                    description = stringResource(Res.string.settings_appearance_desc),
                    enabled = false
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionTitle(stringResource(Res.string.settings_privacy_data))
                SettingsSection {
                    SettingsRow(
                        title = stringResource(Res.string.privacy_policy),
                        description = privacyPolicyUrl.ifBlank { configureUrlFirst },
                        onClick = { openConfiguredUrl(privacyPolicyUrl) }
                    )
                    SettingsDivider()
                    SettingsRow(
                        title = stringResource(Res.string.terms_of_service),
                        description = termsOfServiceUrl.ifBlank { configureUrlFirst },
                        onClick = { openConfiguredUrl(termsOfServiceUrl) }
                    )
                    SettingsDivider()
                    SettingsRow(
                        title = stringResource(Res.string.export_my_data),
                        description = stringResource(Res.string.export_my_data_desc),
                        enabled = false
                    )
                    SettingsDivider()
                    SettingsRow(
                        title = stringResource(Res.string.delete_account),
                        description = stringResource(Res.string.delete_account_desc),
                        destructive = true,
                        onClick = { openConfiguredUrl(accountDeletionUrl) }
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionTitle(stringResource(Res.string.settings_about))
                SettingsSection {
                    SettingsRow(
                        title = stringResource(Res.string.settings_about),
                        description = stringResource(Res.string.settings_about_desc),
                        enabled = false
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionTitle(stringResource(Res.string.settings_debug))
                SettingsSection {
                    DebugRow(
                        title = stringResource(Res.string.debug_reset_onboarding),
                        description = when {
                            debugResetOnboardingSuccess -> stringResource(Res.string.debug_reset_onboarding_success)
                            debugError != null -> "Error: $debugError"
                            else -> stringResource(Res.string.debug_reset_onboarding_desc)
                        },
                        isLoading = debugResetOnboardingLoading,
                        isSuccess = debugResetOnboardingSuccess,
                        isError = debugError != null,
                        onClick = if (!debugResetOnboardingLoading && !debugResetOnboardingSuccess) {
                            onDebugResetOnboarding
                        } else null
                    )
                    SettingsDivider()
                    DebugRow(
                        title = stringResource(Res.string.debug_launch_onboarding),
                        description = stringResource(Res.string.debug_launch_onboarding_desc),
                        isLoading = false,
                        isSuccess = false,
                        isError = false,
                        onClick = onDebugLaunchOnboarding
                    )
                }
            }

            notice?.let {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))
                ) {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.75f),
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }

            OutlinedButton(
                onClick = onBackClick,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.onBackground
                )
            ) {
                Text(
                    text = stringResource(Res.string.back_cd).uppercase(),
                    style = MaterialTheme.typography.labelLarge,
                    letterSpacing = 1.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SettingsSection(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.16f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.06f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(content = content)
    }
}

@Composable
private fun SettingsRow(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    destructive: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    val contentAlpha = if (enabled) 1f else 0.45f
    Surface(
        onClick = { if (enabled) onClick?.invoke() },
        enabled = enabled && onClick != null,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0f),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (destructive) {
                        MaterialTheme.colorScheme.tertiary.copy(alpha = contentAlpha)
                    } else {
                        MaterialTheme.colorScheme.onBackground.copy(alpha = contentAlpha)
                    },
                    letterSpacing = 1.sp
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.45f * contentAlpha),
                    lineHeight = 18.sp
                )
            }
            if (enabled && onClick != null) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.25f)
                )
            }
        }
    }
}

@Composable
private fun SettingsDivider() {
    HorizontalDivider(
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
        modifier = Modifier.padding(horizontal = 16.dp)
    )
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.45f),
        letterSpacing = 1.5.sp
    )
}

@Composable
private fun DebugRow(
    title: String,
    description: String,
    isLoading: Boolean,
    isSuccess: Boolean,
    isError: Boolean,
    onClick: (() -> Unit)?
) {
    Surface(
        onClick = { onClick?.invoke() },
        enabled = onClick != null,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 1.sp
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = when {
                        isSuccess -> MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
                        isError -> MaterialTheme.colorScheme.error.copy(alpha = 0.8f)
                        else -> MaterialTheme.colorScheme.onBackground.copy(alpha = 0.45f)
                    },
                    lineHeight = 18.sp
                )
            }
            when {
                isLoading -> CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                )
                !isSuccess && !isError -> Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.25f)
                )
            }
        }
    }
}
