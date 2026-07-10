import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {getColors} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder().setName('clear').setDescription('대기열을 비워요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction);
    if (!queue) return;
    const client = getClient(interaction);

    queue.clear();

    return await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('대기열을 비웠어요.').setColor(getColors(client.config).normal)],
    });
  },
} satisfies Command;
