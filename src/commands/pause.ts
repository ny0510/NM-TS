import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {ensurePaused, validateMusicCommand} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('pause').setDescription('음악을 일시정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const isPaused = await ensurePaused(interaction);
    if (!isPaused) return;

    await queue.pause(true);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 일시정지했어요.').setColor(COLORS.normal)]});
  },
} satisfies Command;
