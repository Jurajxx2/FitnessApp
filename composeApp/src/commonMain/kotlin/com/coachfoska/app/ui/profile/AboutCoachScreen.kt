package com.coachfoska.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import com.coachfoska.app.ui.components.CoachSectionHeader
import com.coachfoska.app.ui.components.CoachTopBar
import org.jetbrains.compose.resources.stringResource

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
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            CoachTopBar(title = stringResource(Res.string.about_foska), onBackClick = onBackClick)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp)
            ) {
                // Coach Intro
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = coachName.uppercase(),
                        style = MaterialTheme.typography.displaySmall,
                        color = MaterialTheme.colorScheme.onBackground,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = coachTitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        lineHeight = 20.sp
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = coachBio,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                        lineHeight = 26.sp,
                        modifier = Modifier.padding(24.dp)
                    )
                }

                // Certifications
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = stringResource(Res.string.certifications_section),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 1.5.sp
                    )
                    certifications.forEach { cert ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = cert,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                }

                // Connect
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = stringResource(Res.string.connect_section),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 1.5.sp
                    )
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(4.dp)) {
                            ConnectRow(stringResource(Res.string.instagram_label), instagram)
                            HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f), modifier = Modifier.padding(horizontal = 16.dp))
                            ConnectRow(stringResource(Res.string.website_label), website)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}

@Composable
private fun ConnectRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
    }
}
