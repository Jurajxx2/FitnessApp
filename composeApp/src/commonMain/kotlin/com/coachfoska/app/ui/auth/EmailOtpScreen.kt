package com.coachfoska.app.ui.auth

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.back_cd
import coachfoska.composeapp.generated.resources.*
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthState
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsTextField
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun EmailOtpRoute(
    onBackClick: () -> Unit,
    onOtpSent: (email: String) -> Unit,
    onNavigateToHome: () -> Unit,
    onNavigateToOnboarding: (userId: String) -> Unit,
    viewModel: AuthViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.otpSent) {
        if (state.otpSent) {
            viewModel.onIntent(AuthIntent.NavigatedToVerifyOtp)
            onOtpSent(state.email)
        }
    }
    LaunchedEffect(state.navigateToHome) {
        if (state.navigateToHome) {
            viewModel.onIntent(AuthIntent.NavigatedToHome)
            onNavigateToHome()
        }
    }
    LaunchedEffect(state.navigateToOnboarding) {
        if (state.navigateToOnboarding) {
            viewModel.onIntent(AuthIntent.NavigatedToOnboarding)
            onNavigateToOnboarding(state.authenticatedUser?.id ?: "")
        }
    }

    EmailOtpScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailOtpScreen(
    state: AuthState,
    onIntent: (AuthIntent) -> Unit,
    onBackClick: () -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    var passwordVisible by remember { mutableStateOf(false) }

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
                text = stringResource(Res.string.email_sign_in_title),
                style = MaterialTheme.typography.displayMedium,
                color = DsTheme.colors.textPrimary
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(Res.string.email_sign_in_desc),
                style = MaterialTheme.typography.bodyLarge,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.6f)
            )

            Spacer(modifier = Modifier.height(48.dp))

            DsTextField(
                value = state.email,
                onValueChange = { onIntent(AuthIntent.EmailChanged(it)) },
                label = stringResource(Res.string.email_address_label),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next
                ),
                enabled = !state.isLoading
            )

            Spacer(modifier = Modifier.height(16.dp))

            DsTextField(
                value = state.password,
                onValueChange = { onIntent(AuthIntent.PasswordChanged(it)) },
                label = stringResource(Res.string.password_label),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        if (state.email.isNotBlank() && state.password.isNotBlank()) {
                            keyboardController?.hide()
                            onIntent(AuthIntent.SignInWithPassword)
                        }
                    }
                ),
                enabled = !state.isLoading,
                visualTransformation = if (passwordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = stringResource(
                                if (passwordVisible) Res.string.hide_password_cd else Res.string.show_password_cd
                            )
                        )
                    }
                }
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
                text = stringResource(Res.string.sign_in_button),
                onClick = {
                    keyboardController?.hide()
                    onIntent(AuthIntent.SignInWithPassword)
                },
                enabled = state.email.isNotBlank() && state.password.isNotBlank(),
                isLoading = state.isLoading
            )

            Spacer(modifier = Modifier.height(16.dp))

            TextButton(
                onClick = {
                    keyboardController?.hide()
                    onIntent(AuthIntent.SendOtp)
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = state.email.isNotBlank() && !state.isLoading
            ) {
                Text(
                    text = stringResource(Res.string.sign_in_with_otp),
                    style = MaterialTheme.typography.labelLarge,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.65f),
                    letterSpacing = 1.sp
                )
            }
        }
    }
}
