package com.coachfoska.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTopBar

private val coachName = "Andrea Krišková"
private val coachTitle = "Certified Bodybuilding Coach · Fitness Trainer · Nutrition & Mental Coach"
private val coachBio = """
    Andrea is a certified coach based in Prague with over 8 years of experience
    in fitness training, nutrition planning, and mental performance coaching.
    She believes in a holistic approach that combines smart training, precise
    nutrition, and a strong mindset to achieve lasting results.
""".trimIndent()
private val certifications = listOf(
    "NASM Certified Personal Trainer",
    "Precision Nutrition Level 1 Coach",
    "ISSA Certified Bodybuilding Specialist",
    "Mental Performance Coach"
)
private const val instagram = "@coachfoska"
private const val website = "coachfoska.com"

@Composable
fun AboutCoachScreen(onBackClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        CoachTopBar(title = "About Coach", onBackClick = onBackClick)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            Text(
                text = coachName,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = coachTitle,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                fontSize = 13.sp,
                lineHeight = 20.sp
            )

            HorizontalDivider(
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
                modifier = Modifier.padding(vertical = 24.dp)
            )

            Text(
                text = coachBio,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                fontSize = 14.sp,
                lineHeight = 22.sp
            )

            HorizontalDivider(
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
                modifier = Modifier.padding(vertical = 24.dp)
            )

            CoachSectionHeader(text = "CERTIFICATIONS")
            Spacer(modifier = Modifier.height(12.dp))
            certifications.forEach { cert ->
                Text(
                    text = "· $cert",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            HorizontalDivider(
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
                modifier = Modifier.padding(vertical = 24.dp)
            )

            CoachSectionHeader(text = "CONNECT")
            Spacer(modifier = Modifier.height(12.dp))
            ContactRow("Instagram", instagram)
            ContactRow("Web", website)

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ContactRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            fontSize = 14.sp
        )
        Text(
            text = value,
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
