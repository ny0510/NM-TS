import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, type HexColorString, MessageFlags} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {Logger} from '@/utils/logger';
import {addTrackToQueue} from '@/utils/music/playerUtils';

const logger = new Logger('QuickAdd');

/**
 * 빠른 추가 버튼 컴포넌트 생성
 */
export function createQuickAddButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('quick_add').setLabel('다시 추가').setEmoji('➕').setStyle(ButtonStyle.Secondary));
}

/**
 * 빠른 추가 버튼 클릭 핸들러
 */
export async function handleQuickAddButton(interaction: ButtonInteraction): Promise<void> {
  const client = interaction.client as NMClient;

  // 임베드에서 URL 가져오기
  const url = interaction.message.embeds[0]?.url;
  if (!url) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('음악 URL을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 사용자가 음성 채널에 있는지 확인
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const voiceChannel = member?.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('먼저 음성 채널에 들어가 주세요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  try {
    await addTrackToQueue(client, interaction, {query: url, source: 'quick_add'});
  } catch (error) {
    logger.error(`Quick add error: ${error}`);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('음악을 추가하는 중 오류가 발생했어요.').setColor(client.config.EMBED_COLOR_ERROR)],
    });
  }
}
