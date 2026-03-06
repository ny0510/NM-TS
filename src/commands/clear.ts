import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('clear').setDescription('대기열을 비워요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    queue.clear();

    return await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('대기열을 비웠어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
    });
  },
} as Command;
