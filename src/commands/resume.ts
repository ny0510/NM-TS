import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {ensureResumed} from '@/features/music/guard';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder().setName('resume').setDescription('일시정지된 음악을 다시 재생해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = await validateMusicCommand(interaction);
    if (!queue) return;
    const client = getClient(interaction);

    const isResumed = await ensureResumed(interaction);
    if (!isResumed) return;

    await queue.pause(false);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 다시 재생했어요.').setColor(COLORS.normal)]});
  },
} satisfies Command;
