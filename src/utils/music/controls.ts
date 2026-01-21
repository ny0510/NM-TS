import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, MessageFlags} from 'discord.js';
import type {Player} from 'magmastream';

import {createQuickAddButton} from './quickAddButton';
import type {NMClient} from '@/client/Client';
import {ensurePlaying} from '@/utils/music';

export function createPlayerControls(player: Player, trackUri: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder().setCustomId('control_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('control_pause')
      .setEmoji(player.paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('control_next').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
  );

  const quickAddRow = createQuickAddButton(trackUri);
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

  await interaction.deferUpdate();

  switch (interaction.customId) {
    case 'control_prev': {
      if (player.position > 5000) {
        player.seek(0);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queue = player.queue as any;
      if (queue.previous && queue.previous.length > 0) {
        const previousTrack = queue.previous.pop();
        if (previousTrack) {
          player.queue.add(previousTrack, 0);
          player.stop();
        }
      } else {
        player.seek(0);
      }
      break;
    }

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
