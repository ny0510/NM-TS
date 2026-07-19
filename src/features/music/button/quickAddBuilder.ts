import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags, PermissionsBitField, codeBlock} from 'discord.js';

import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeDeferReply, safeEditReply, safeReply} from '@/shared/discord/interactions';
import {checkBotPermissions, formatMissingPermissions} from '@/shared/discord/permissions';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import {addTrackToQueue} from '@/features/music/track/operations';

// ── UI Builder ──

export function createQuickAddButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('quick_add').setEmoji('➕').setStyle(ButtonStyle.Secondary));
}

// ── Handler ──

const logger = new Logger('QuickAdd');

export async function handleQuickAddButton(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);

  const userMember = interaction.guild?.members.cache.get(interaction.user.id);
  const voiceChannel = userMember?.voice.channel;

  const requiredPermissions = [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak];
  const {result, missing} = await checkBotPermissions(interaction, requiredPermissions, voiceChannel);

  if (!result) {
    const missingPermissionsText = formatMissingPermissions(missing);
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '명령어를 실행하기 위해 필요한 권한이 부족해요. 아래 권한을 추가해 주세요.', codeBlock('diff', missingPermissionsText))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const url = interaction.message.embeds[0]?.url;
  if (!url) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '음악 URL을 찾을 수 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!voiceChannel) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '먼저 음성 채널에 들어가 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const deferred = await safeDeferReply(interaction, {flags: MessageFlags.Ephemeral});
  if (!deferred) return;

  try {
    await addTrackToQueue(client, interaction, {query: url, source: 'quick_add'});
  } catch (error) {
    logger.error(toError(error, 'Quick add error'));
    await safeEditReply(interaction, {
      embeds: [createErrorEmbed(client, '음악을 추가하는 중 오류가 발생했어요.')],
    });
  }
}
