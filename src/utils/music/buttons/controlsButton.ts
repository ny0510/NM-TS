import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags} from 'discord.js';

import type {Queue} from '@/structures/Queue';
import {safeReply} from '@/utils/discord';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {ensurePlaying, ensureSameVoiceChannel} from '@/utils/music';
import {createQuickAddButton} from '@/utils/music/buttons/quickAddButton';

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

  return row;
}

export async function handlePlayerControlsButtons(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);

  if (!queue) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '현재 재생 중인 음악이 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await ensurePlaying(interaction))) return;
  if (!(await ensureSameVoiceChannel(interaction))) return;

  const currentTrack = queue.getCurrent();
  if (!currentTrack) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '현재 재생 중인 음악이 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 현재 재생 중인 트랙과 버튼이 생성된 시점의 트랙(임베드 URL)이 같은지 확인
  const embedUrl = interaction.message.embeds[0]?.url;
  if (embedUrl && embedUrl !== currentTrack.info.uri) {
    await interaction.reply({
      embeds: [createErrorEmbed(client, '만료된 컨트롤러에요.', '현재 재생 중인 음악의 컨트롤러를 사용해 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  switch (interaction.customId) {
    case 'control_pause':
      await queue.pause(!queue.paused);
      await interaction.editReply({
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
