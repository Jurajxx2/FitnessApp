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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthState
import com.coachfoska.app.presentation.auth.AuthViewModel
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

@OptIn(ExperimentalMaterial3Api::class)
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
            text = "Enter your email",
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.ExtraBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "We'll send you a one-time code to sign in.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 15.sp
        )

        Spacer(modifier = Modifier.height(40.dp))

        OutlinedTextField(
            value = state.email,
            onValueChange = { onIntent(AuthIntent.EmailChanged(it)) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email address", color = Color.White.copy(alpha = 0.6f)) },
            singleLine = true,
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
                onIntent(AuthIntent.SendOtp)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(4.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA90707)),
            enabled = state.email.isNotBlank() && !state.isLoading
        ) {
            if (state.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Text(
                    text = "SEND CODE",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}
