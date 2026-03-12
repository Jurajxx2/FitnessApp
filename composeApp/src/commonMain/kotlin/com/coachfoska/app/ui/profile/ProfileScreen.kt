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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.profile.ProfileIntent
import com.coachfoska.app.presentation.profile.ProfileViewModel

@Composable
fun ProfileScreen(
    profileViewModel: ProfileViewModel,
    onProgressClick: () -> Unit,
    onAboutCoachClick: () -> Unit,
    onLogoutComplete: () -> Unit
) {
    val state by profileViewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.signedOut) {
        if (state.signedOut) {
            profileViewModel.onIntent(ProfileIntent.SignedOut)
            onLogoutComplete()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .verticalScroll(rememberScrollState())
    ) {
        // Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.05f))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = state.user?.fullName ?: "Loading...",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = state.user?.email ?: "",
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 14.sp
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Stats
        state.user?.let { user ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                user.goal?.let { ProfileStatCard(label = "Goal", value = it.displayName, modifier = Modifier.weight(1f)) }
                user.heightCm?.let { ProfileStatCard(label = "Height", value = "${it.toInt()} cm", modifier = Modifier.weight(1f)) }
                user.weightKg?.let { ProfileStatCard(label = "Weight", value = "${it} kg", modifier = Modifier.weight(1f)) }
            }
        }

        Divider(color = Color.White.copy(alpha = 0.08f))

        // Menu items
        ProfileMenuItem(label = "My Progress", onClick = onProgressClick)
        Divider(color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 24.dp))
        ProfileMenuItem(label = "About Coach Foška", onClick = onAboutCoachClick)
        Divider(color = Color.White.copy(alpha = 0.08f))

        Spacer(modifier = Modifier.height(24.dp))

        if (state.isSigningOut) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFA90707))
            }
        } else {
            TextButton(
                onClick = { profileViewModel.onIntent(ProfileIntent.SignOut) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
            ) {
                Text(
                    text = "LOG OUT",
                    color = Color(0xFFA90707),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp
                )
            }
        }

        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(24.dp))
        }
    }
}

@Composable
private fun ProfileStatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = label, color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
        Text(text = value, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
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
        Text(text = label, color = Color.White, fontSize = 15.sp)
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.4f)
        )
    }
}
