package com.coachfoska.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.profile.ProfileIntent
import com.coachfoska.app.presentation.profile.ProfileState
import com.coachfoska.app.presentation.profile.ProfileViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ProfileRoute(
    userId: String,
    onProgressClick: () -> Unit,
    onAboutCoachClick: () -> Unit,
    onLogoutComplete: () -> Unit,
    viewModel: ProfileViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.signedOut) {
        if (state.signedOut) {
            viewModel.onIntent(ProfileIntent.SignedOut)
            onLogoutComplete()
        }
    }

    ProfileScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onProgressClick = onProgressClick,
        onAboutCoachClick = onAboutCoachClick
    )
}

@Composable
fun ProfileScreen(
    state: ProfileState,
    onIntent: (ProfileIntent) -> Unit,
    onProgressClick: () -> Unit,
    onAboutCoachClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = state.user?.fullName ?: "Loading...",
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = state.user?.email ?: "",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                fontSize = 14.sp
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        state.user?.let { user ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                user.goal?.let {
                    ProfileStatCard(
                        label = "Goal",
                        value = it.displayName,
                        modifier = Modifier.weight(1f)
                    )
                }
                user.heightCm?.let {
                    ProfileStatCard(
                        label = "Height",
                        value = "${it.toInt()} cm",
                        modifier = Modifier.weight(1f)
                    )
                }
                user.weightKg?.let {
                    ProfileStatCard(
                        label = "Weight",
                        value = "${it} kg",
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))
        ProfileMenuItem(label = "My Progress", onClick = onProgressClick)
        HorizontalDivider(
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f),
            modifier = Modifier.padding(horizontal = 24.dp)
        )
        ProfileMenuItem(label = "About Coach Foška", onClick = onAboutCoachClick)
        HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))

        Spacer(modifier = Modifier.height(24.dp))

        if (state.isSigningOut) {
            CoachLoadingBox(modifier = Modifier.fillMaxWidth().height(52.dp))
        } else {
            TextButton(
                onClick = { onIntent(ProfileIntent.SignOut) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp)
            ) {
                Text(
                    text = "LOG OUT",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp
                )
            }
        }

        state.error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(24.dp)
            )
        }
    }
}

@Composable
private fun ProfileStatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                RoundedCornerShape(8.dp)
            )
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = label,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 11.sp
        )
        Text(
            text = value,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun ProfileMenuItem(label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 15.sp
        )
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
        )
    }
}
