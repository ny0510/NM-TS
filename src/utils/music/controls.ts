import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, MessageFlags} from 'discord.js';
import type {Player} from 'magmastream';

import {createQuickAddButton} from './quickAddButton';
import type {NMClient} from '@/client/Client';
import {ensurePlaying} from '@/utils/music';

export function createPlayerControls(player: Player, trackUri: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('control_pause')
      .setEmoji(player.paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('control_next').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
  );

  const quickAddRow = createQuickAddButton();
  row.addComponents(quickAddRow.components);

  return row;
}

export async function handlePlayerControls(interaction: ButtonInteraction): Promise<void> {
  const client = interaction.client as NMClient;
  const player = client.manager.players.get(interaction.guildId!);

  if (!player) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('재생 중인 음악이 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await ensurePlaying(interaction))) return;

  const currentTrack = await player.queue.getCurrent();
  if (!currentTrack) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('재생 중인 음악이 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 현재 재생 중인 트랙과 버튼이 생성된 시점의 트랙(임베드 URL)이 같은지 확인
  const embedUrl = interaction.message.embeds[0]?.url;
  if (embedUrl && embedUrl !== currentTrack.uri) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('만료된 컨트롤러에요.').setDescription('현재 재생 중인 음악의 컨트롤러를 사용해 주세요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  switch (interaction.customId) {
    case 'control_pause':
      player.pause(!player.paused);
      await interaction.editReply({
        components: [createPlayerControls(player, currentTrack.uri)],
      });
      break;

    case 'control_next':
      player.stop();
      break;
  }
}
