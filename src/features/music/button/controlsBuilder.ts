import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags} from 'discord.js';

import type {Queue} from '@/features/music/queue/Queue';
import {safeDeferUpdate, safeEditReply, safeReply} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {ensurePlaying, ensureSameVoiceChannel} from '@/features/music/guard';
import {createQuickAddButton} from '@/features/music/button/quickAddBuilder';

export function createPlayerControls(queue: Queue, trackUri: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('control_pause')
      .setEmoji(queue.paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('control_next').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
  );

  const quickAddRow = createQuickAddButton();
  row.addComponents(quickAddRow.components);

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('fav_toggle')
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Secondary),
  );

  return row;
}

export async function handlePlayerControlsButtons(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);

  if (!queue) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '현재 재생 중인 음악이 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await ensurePlaying(interaction))) return;
  if (!(await ensureSameVoiceChannel(interaction))) return;

  const currentTrack = queue.getCurrent();
  if (!currentTrack) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '현재 재생 중인 음악이 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  /* 현재 재생 중인 트랙과 버튼이 생성된 시점의 트랙(임베드 URL)이 같은지 확인 */
  const embedUrl = interaction.message.embeds[0]?.url;
  if (embedUrl && embedUrl !== currentTrack.info.uri) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '만료된 컨트롤러에요.', '현재 재생 중인 음악의 컨트롤러를 사용해 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const deferred = await safeDeferUpdate(interaction);
  if (!deferred) return;

  switch (interaction.customId) {
    case 'control_pause':
      await queue.pause(!queue.paused);
      await safeEditReply(interaction, {
        components: [createPlayerControls(queue, currentTrack.info.uri ?? '')],
      });
      break;

    case 'control_next':
      if (!queue.size()) {
        return await safeReply(interaction, {
          embeds: [createErrorEmbed(client, '대기열에 있는 음악보다 더 많은 곡을 건너뛸 수 없어요.', `대기열에 ${queue.size()}곡이 있어요.`)],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await queue.stop();
      }
      break;
  }
}
