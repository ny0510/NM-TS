import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('stop').setDescription('음악을 정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await ensurePlayerReady(interaction))) return;

    const client = getClient(interaction);
    const player = client.manager.players.get(interaction.guildId!);
    if (!player) return;

    player.set('stoppedByCommand', true);
    player.destroy();

    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('음악을 정지했어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
    });
  },
} as Command;
