import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {validateMusicCommand} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('clear').setDescription('대기열을 비워요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction);
    if (!queue) return;
    queue.clear();

    return await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('대기열을 비웠어요.').setColor(COLORS.normal)],
    });
  },
} satisfies Command;
