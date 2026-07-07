package com.coachfoska.app.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.chat_image_preview
import coachfoska.composeapp.generated.resources.chat_no_messages_yet
import coachfoska.composeapp.generated.resources.coach_hub_action_checkin
import coachfoska.composeapp.generated.resources.coach_hub_action_plan_review
import coachfoska.composeapp.generated.resources.coach_hub_action_support
import coachfoska.composeapp.generated.resources.coach_hub_actions
import coachfoska.composeapp.generated.resources.coach_hub_ai_chat_subtitle
import coachfoska.composeapp.generated.resources.coach_hub_ai_chat_title
import coachfoska.composeapp.generated.resources.coach_hub_checkin_label
import coachfoska.composeapp.generated.resources.coach_hub_checkin_value
import coachfoska.composeapp.generated.resources.coach_hub_coach_about
import coachfoska.composeapp.generated.resources.coach_hub_coach_name
import coachfoska.composeapp.generated.resources.coach_hub_coach_title
import coachfoska.composeapp.generated.resources.coach_hub_conversations
import coachfoska.composeapp.generated.resources.coach_hub_eyebrow
import coachfoska.composeapp.generated.resources.coach_hub_human_chat_subtitle
import coachfoska.composeapp.generated.resources.coach_hub_human_chat_title
import coachfoska.composeapp.generated.resources.coach_hub_membership_label
import coachfoska.composeapp.generated.resources.coach_hub_membership_plan
import coachfoska.composeapp.generated.resources.coach_hub_membership_renewal
import coachfoska.composeapp.generated.resources.coach_hub_membership_status
import coachfoska.composeapp.generated.resources.coach_hub_response_label
import coachfoska.composeapp.generated.resources.coach_hub_response_value
import coachfoska.composeapp.generated.resources.coach_hub_subtitle
import coachfoska.composeapp.generated.resources.coach_hub_title
import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.presentation.chat.ChatHubViewModel
import com.coachfoska.designsystem.theme.DsTheme
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ChatHubRoute(
    userId: String,
    onHumanCoachClick: () -> Unit,
    onAiCoachClick: () -> Unit,
    onCoachProfileClick: () -> Unit,
    viewModel: ChatHubViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ChatHubScreen(
        summaries = state.summaries,
        isLoading = state.isLoading,
        onHumanCoachClick = onHumanCoachClick,
        onAiCoachClick = onAiCoachClick,
        onCoachProfileClick = onCoachProfileClick
    )
}

@Composable
fun ChatHubScreen(
    summaries: List<ChatConversationSummary>,
    isLoading: Boolean,
    onHumanCoachClick: () -> Unit,
    onAiCoachClick: () -> Unit,
    onCoachProfileClick: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = DsTheme.colors.background
    ) {
        val humanSummary = summaries.firstOrNull { it.chatType == ChatType.Human }
        val aiSummary = summaries.firstOrNull { it.chatType == ChatType.Ai }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            CoachHubHeader()
            MembershipPanel()
            CoachProfilePanel(onClick = onCoachProfileClick)

            SectionLabel(text = stringResource(Res.string.coach_hub_conversations))
            ConversationCard(
                title = stringResource(Res.string.coach_hub_human_chat_title),
                subtitle = humanSummary?.previewText() ?: stringResource(Res.string.coach_hub_human_chat_subtitle),
                fallbackSubtitle = stringResource(Res.string.chat_no_messages_yet),
                unreadCount = humanSummary?.unreadCount ?: 0,
                icon = Icons.Default.Person,
                isLoading = isLoading && humanSummary == null,
                onClick = onHumanCoachClick
            )

            if (BuildKonfig.AI_COACH_ENABLED && DsTheme.features.aiCoach) {
                ConversationCard(
                    title = stringResource(Res.string.coach_hub_ai_chat_title),
                    subtitle = aiSummary?.previewText() ?: stringResource(Res.string.coach_hub_ai_chat_subtitle),
                    fallbackSubtitle = stringResource(Res.string.chat_no_messages_yet),
                    unreadCount = aiSummary?.unreadCount ?: 0,
                    icon = Icons.Default.SmartToy,
                    isLoading = isLoading && aiSummary == null,
                    onClick = onAiCoachClick
                )
            }

            SectionLabel(text = stringResource(Res.string.coach_hub_actions))
            QuickActionGrid(
                onCheckInClick = onHumanCoachClick,
                onPlanReviewClick = onHumanCoachClick,
                onSupportClick = onHumanCoachClick
            )

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun CoachHubHeader() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(Res.string.coach_hub_eyebrow),
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.45f),
            letterSpacing = 2.sp
        )
        Text(
            text = stringResource(Res.string.coach_hub_title),
            style = MaterialTheme.typography.headlineLarge,
            color = DsTheme.colors.textPrimary,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = stringResource(Res.string.coach_hub_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.62f),
            lineHeight = 20.sp
        )
    }
}

@Composable
private fun MembershipPanel() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = DsTheme.colors.surface,
        border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(Res.string.coach_hub_membership_label).uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.45f),
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = stringResource(Res.string.coach_hub_membership_plan),
                        style = MaterialTheme.typography.titleLarge,
                        color = DsTheme.colors.textPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = stringResource(Res.string.coach_hub_membership_renewal),
                        style = MaterialTheme.typography.bodySmall,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.55f)
                    )
                }
                StatusPill(text = stringResource(Res.string.coach_hub_membership_status))
            }

            HorizontalDivider(color = DsTheme.colors.outlineSubtle)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MembershipStat(
                    label = stringResource(Res.string.coach_hub_checkin_label),
                    value = stringResource(Res.string.coach_hub_checkin_value),
                    modifier = Modifier.weight(1f)
                )
                MembershipStat(
                    label = stringResource(Res.string.coach_hub_response_label),
                    value = stringResource(Res.string.coach_hub_response_value),
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun StatusPill(text: String) {
    Surface(
        shape = RoundedCornerShape(50),
        color = DsTheme.colors.actionPrimary.copy(alpha = 0.12f),
        contentColor = DsTheme.colors.actionPrimary
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(14.dp))
            Text(text = text, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun MembershipStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.42f),
            letterSpacing = 1.sp
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = DsTheme.colors.textPrimary,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun CoachProfilePanel(onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = DsTheme.colors.surfaceElevated.copy(alpha = 0.5f),
        border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(54.dp).clip(CircleShape),
                color = DsTheme.colors.actionPrimary,
                contentColor = DsTheme.colors.onActionPrimary
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.SupportAgent, contentDescription = null, modifier = Modifier.size(30.dp))
                }
            }

            Spacer(Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = stringResource(Res.string.coach_hub_coach_name),
                    style = MaterialTheme.typography.titleMedium,
                    color = DsTheme.colors.textPrimary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(Res.string.coach_hub_coach_title),
                    style = MaterialTheme.typography.bodySmall,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = stringResource(Res.string.coach_hub_coach_about),
                    style = MaterialTheme.typography.labelSmall,
                    color = DsTheme.colors.actionPrimary,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = DsTheme.colors.textPrimary.copy(alpha = 0.24f)
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = DsTheme.colors.textPrimary.copy(alpha = 0.52f),
        letterSpacing = 1.sp
    )
}

@Composable
private fun ConversationCard(
    title: String,
    subtitle: String,
    fallbackSubtitle: String,
    unreadCount: Int,
    icon: ImageVector,
    isLoading: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = DsTheme.colors.surface,
        border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
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
                    color = DsTheme.colors.surfaceElevated,
                    contentColor = DsTheme.colors.textSecondary
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(icon, contentDescription = null, modifier = Modifier.size(26.dp))
                    }
                }
            }

            Spacer(Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    color = DsTheme.colors.textPrimary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = if (isLoading) fallbackSubtitle else subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.55f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 13.sp
                )
            }

            IconButton(onClick = onClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Chat,
                    contentDescription = null,
                    tint = DsTheme.colors.actionPrimary
                )
            }
        }
    }
}

@Composable
private fun QuickActionGrid(
    onCheckInClick: () -> Unit,
    onPlanReviewClick: () -> Unit,
    onSupportClick: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            QuickActionButton(
                label = stringResource(Res.string.coach_hub_action_checkin),
                icon = Icons.Default.EventAvailable,
                onClick = onCheckInClick,
                modifier = Modifier.weight(1f)
            )
            QuickActionButton(
                label = stringResource(Res.string.coach_hub_action_plan_review),
                icon = Icons.Default.FitnessCenter,
                onClick = onPlanReviewClick,
                modifier = Modifier.weight(1f)
            )
        }
        QuickActionButton(
            label = stringResource(Res.string.coach_hub_action_support),
            icon = Icons.Default.SupportAgent,
            onClick = onSupportClick,
            modifier = Modifier.fillMaxWidth(),
            containerColor = DsTheme.colors.surfaceElevated.copy(alpha = 0.55f)
        )
    }
}

@Composable
private fun QuickActionButton(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    containerColor: Color = DsTheme.colors.surface
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(58.dp),
        shape = RoundedCornerShape(8.dp),
        color = containerColor,
        border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = DsTheme.colors.actionPrimary, modifier = Modifier.size(20.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = DsTheme.colors.textPrimary,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ChatConversationSummary.previewText(): String =
    lastMessage?.let { msg ->
        when (val content = msg.content) {
            is MessageContent.Text -> content.text
            is MessageContent.Image -> stringResource(Res.string.chat_image_preview)
        }
    } ?: stringResource(Res.string.chat_no_messages_yet)
