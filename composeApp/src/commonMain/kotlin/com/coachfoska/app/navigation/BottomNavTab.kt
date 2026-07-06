package com.coachfoska.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.ui.graphics.vector.ImageVector
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.nav_activity
import coachfoska.composeapp.generated.resources.nav_chat
import coachfoska.composeapp.generated.resources.nav_home
import coachfoska.composeapp.generated.resources.nav_nutrition
import coachfoska.composeapp.generated.resources.nav_profile
import org.jetbrains.compose.resources.StringResource

enum class BottomNavTab(val labelRes: StringResource, val icon: ImageVector) {
    Home(Res.string.nav_home, Icons.Default.Home),
    Activity(Res.string.nav_activity, Icons.Default.FitnessCenter),
    Chat(Res.string.nav_chat, Icons.AutoMirrored.Filled.Chat),
    Nutrition(Res.string.nav_nutrition, Icons.Default.Restaurant),
    Profile(Res.string.nav_profile, Icons.Default.Person)
}
