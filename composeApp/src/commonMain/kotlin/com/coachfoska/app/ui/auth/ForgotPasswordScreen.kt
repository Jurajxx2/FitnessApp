package com.coachfoska.app.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.*
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthState
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.designsystem.theme.DsTheme
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ForgotPasswordRoute(
    initialEmail: String,
    onBackClick: () -> Unit,
    viewModel: AuthViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(initialEmail) {
        if (state.email.isBlank() && initialEmail.isNotBlank()) {
            viewModel.onIntent(AuthIntent.EmailChanged(initialEmail))
        }
    }

    ForgotPasswordScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForgotPasswordScreen(
    state: AuthState,
    onIntent: (AuthIntent) -> Unit,
    onBackClick: () -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.back_cd)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DsTheme.colors.background,
                    navigationIconContentColor = DsTheme.colors.textPrimary
                ),
                windowInsets = WindowInsets(0)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 32.dp, vertical = 24.dp)
        ) {
            Text(
                text = stringResource(Res.string.forgot_password_title),
                style = MaterialTheme.typography.displayMedium,
                color = DsTheme.colors.textPrimary
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(
                    if (state.passwordResetEmailSent) {
                        Res.string.password_reset_sent_desc
                    } else {
                        Res.string.forgot_password_desc
                    }
                ),
                style = MaterialTheme.typography.bodyLarge,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.6f)
            )

            Spacer(modifier = Modifier.height(48.dp))

            if (state.passwordResetEmailSent) {
                DsButton(
                    text = stringResource(Res.string.back_to_sign_in),
                    onClick = onBackClick
                )
            } else {
                DsTextField(
                    value = state.email,
                    onValueChange = { onIntent(AuthIntent.EmailChanged(it)) },
                    label = stringResource(Res.string.email_address_label),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            keyboardController?.hide()
                            onIntent(AuthIntent.SendPasswordResetEmail)
                        }
                    ),
                    enabled = !state.isLoading
                )

                state.error?.let { error ->
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall,
                        color = DsTheme.colors.error
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                DsButton(
                    text = stringResource(Res.string.send_reset_link),
                    onClick = {
                        keyboardController?.hide()
                        onIntent(AuthIntent.SendPasswordResetEmail)
                    },
                    enabled = state.email.isNotBlank(),
                    isLoading = state.isLoading
                )
            }
        }
    }
}
