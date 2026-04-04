package com.coachfoska.app.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.presentation.chat.ChatHubViewModel
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ChatHubRoute(
    userId: String,
    onHumanCoachClick: () -> Unit,
    onAiCoachClick: () -> Unit,
    viewModel: ChatHubViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ChatHubScreen(
        summaries = state.summaries,
        onHumanCoachClick = onHumanCoachClick,
        onAiCoachClick = onAiCoachClick
    )
}

@Composable
fun ChatHubScreen(
    summaries: List<ChatConversationSummary>,
    onHumanCoachClick: () -> Unit,
    onAiCoachClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        val humanSummary = summaries.firstOrNull { it.chatType == ChatType.Human }
        ConversationRow(
            title = "Coach",
            subtitle = humanSummary?.lastMessage?.let { msg ->
                when (val c = msg.content) {
                    is MessageContent.Text -> c.text
                    is MessageContent.Image -> "📷 Image"
                }
            } ?: "No messages yet",
            unreadCount = humanSummary?.unreadCount ?: 0,
            icon = { Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(28.dp)) },
            onClick = onHumanCoachClick
        )
        HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))

        if (BuildKonfig.AI_COACH_ENABLED) {
            val aiSummary = summaries.firstOrNull { it.chatType == ChatType.Ai }
            ConversationRow(
                title = "AI Coach",
                subtitle = aiSummary?.lastMessage?.let { msg ->
                    when (val c = msg.content) {
                        is MessageContent.Text -> c.text
                        is MessageContent.Image -> "📷 Image"
                    }
                } ?: "Ask your AI coach anything",
                unreadCount = aiSummary?.unreadCount ?: 0,
                icon = { Icon(Icons.Default.SmartToy, contentDescription = null, modifier = Modifier.size(28.dp)) },
                onClick = onAiCoachClick
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f))
        }
    }
}

@Composable
private fun ConversationRow(
    title: String,
    subtitle: String,
    unreadCount: Int,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BadgedBox(
            badge = {
                if (unreadCount > 0) {
                    Badge { Text(unreadCount.coerceAtMost(99).toString()) }
                }
            }
        ) {
            Surface(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape),
                color = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurfaceVariant
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center
                ) {
                    icon()
                }
            }
        }

        Spacer(Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontSize = 13.sp
            )
        }
    }
}
