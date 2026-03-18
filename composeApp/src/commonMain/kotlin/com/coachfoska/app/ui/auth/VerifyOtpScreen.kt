package com.coachfoska.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthState
import com.coachfoska.app.presentation.auth.AuthViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun VerifyOtpRoute(
    email: String,
    onBackClick: () -> Unit,
    onNavigateToHome: () -> Unit,
    onNavigateToOnboarding: (userId: String) -> Unit,
    viewModel: AuthViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(email) {
        viewModel.onIntent(AuthIntent.EmailChanged(email))
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

    VerifyOtpScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerifyOtpScreen(
    state: AuthState,
    onIntent: (AuthIntent) -> Unit,
    onBackClick: () -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .padding(24.dp)
    ) {
        IconButton(onClick = onBackClick) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = Color.White
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Check your email",
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "We sent a 6-digit code to\n${state.email}",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 15.sp
        )

        Spacer(modifier = Modifier.height(40.dp))

        OutlinedTextField(
            value = state.otp,
            onValueChange = { input ->
                if (input.length <= 6 && input.all { it.isDigit() }) {
                    onIntent(AuthIntent.OtpChanged(input))
                    if (input.length == 6) {
                        keyboardController?.hide()
                        onIntent(AuthIntent.VerifyOtp)
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("6-digit code", color = Color.White.copy(alpha = 0.6f)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    keyboardController?.hide()
                    onIntent(AuthIntent.VerifyOtp)
                }
            ),
            textStyle = LocalTextStyle.current.copy(
                textAlign = TextAlign.Center,
                letterSpacing = 8.sp
            ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedBorderColor = Color(0xFFA90707),
                unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
                cursorColor = Color(0xFFA90707)
            ),
            enabled = !state.isLoading
        )

        state.error?.let { error ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                keyboardController?.hide()
                onIntent(AuthIntent.VerifyOtp)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(4.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707)),
            enabled = state.otp.length == 6 && !state.isLoading
        ) {
            if (state.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Text(
                    text = "VERIFY CODE",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(
            onClick = { onIntent(AuthIntent.SendOtp) },
            modifier = Modifier.align(Alignment.CenterHorizontally),
            enabled = !state.isLoading
        ) {
            Text(text = "Resend code", color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp)
        }
    }
}
