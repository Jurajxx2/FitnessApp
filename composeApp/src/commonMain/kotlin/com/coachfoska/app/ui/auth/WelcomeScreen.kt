package com.coachfoska.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.auth.AuthIntent
import com.coachfoska.app.presentation.auth.AuthState
import com.coachfoska.app.presentation.auth.AuthViewModel
import com.coachfoska.app.ui.components.CoachButton
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun WelcomeRoute(
    onNavigateToEmailOtp: () -> Unit,
    onNavigateToHome: (userId: String) -> Unit,
    onNavigateToOnboarding: (userId: String) -> Unit,
    viewModel: AuthViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.navigateToHome) {
        if (state.navigateToHome) {
            viewModel.onIntent(AuthIntent.NavigatedToHome)
            onNavigateToHome(state.authenticatedUser?.id ?: "")
        }
    }
    LaunchedEffect(state.navigateToOnboarding) {
        if (state.navigateToOnboarding) {
            viewModel.onIntent(AuthIntent.NavigatedToOnboarding)
            onNavigateToOnboarding(state.authenticatedUser?.id ?: "")
        }
    }

    WelcomeScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onNavigateToEmailOtp = onNavigateToEmailOtp
    )
}

@Composable
fun WelcomeScreen(
    state: AuthState,
    onIntent: (AuthIntent) -> Unit,
    onNavigateToEmailOtp: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.background.copy(alpha = 0.3f),
                            MaterialTheme.colorScheme.background.copy(alpha = 0.7f),
                            MaterialTheme.colorScheme.background
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 48.dp),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 64.dp)
            ) {
                Text(
                    text = "COACH",
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 8.sp
                )
                Text(
                    text = "FOŠKA",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 8.sp
                )
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Train smart. Eat right.\nStay consistent.",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 24.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                CoachButton(
                    text = "CONTINUE WITH EMAIL",
                    onClick = onNavigateToEmailOtp,
                    enabled = !state.isLoading
                )

                OutlinedButton(
                    onClick = { onIntent(AuthIntent.SignInWithGoogle) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(4.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.onBackground
                    ),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                    ),
                    enabled = !state.isLoading
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onBackground,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "CONTINUE WITH GOOGLE",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp
                        )
                    }
                }

                state.error?.let { error ->
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}
