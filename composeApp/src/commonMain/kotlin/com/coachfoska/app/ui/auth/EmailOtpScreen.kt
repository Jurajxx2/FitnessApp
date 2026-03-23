package com.coachfoska.app.ui.auth

import androidx.compose.foundation.background
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
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthState
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachTextField
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun EmailOtpRoute(
    onBackClick: () -> Unit,
    onOtpSent: (email: String) -> Unit,
    viewModel: AuthViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.otpSent) {
        if (state.otpSent) {
            viewModel.onIntent(AuthIntent.NavigatedToVerifyOtp)
            onOtpSent(state.email)
        }
    }

    EmailOtpScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick
    )
}

@Composable
fun EmailOtpScreen(
    state: AuthState,
    onIntent: (AuthIntent) -> Unit,
    onBackClick: () -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp)
    ) {
        IconButton(onClick = onBackClick) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = MaterialTheme.colorScheme.onBackground
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Enter your email",
            color = MaterialTheme.colorScheme.onBackground,
            style = MaterialTheme.typography.displayMedium
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "We'll send you a one-time code to sign in.",
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
            style = MaterialTheme.typography.bodyLarge
        )

        Spacer(modifier = Modifier.height(40.dp))

        CoachTextField(
            value = state.email,
            onValueChange = { onIntent(AuthIntent.EmailChanged(it)) },
            label = "Email address",
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    keyboardController?.hide()
                    onIntent(AuthIntent.SendOtp)
                }
            ),
            enabled = !state.isLoading
        )

        state.error?.let { error ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Spacer(modifier = Modifier.height(24.dp))

        CoachButton(
            text = "SEND CODE",
            onClick = {
                keyboardController?.hide()
                onIntent(AuthIntent.SendOtp)
            },
            enabled = state.email.isNotBlank(),
            isLoading = state.isLoading
        )
    }
}
