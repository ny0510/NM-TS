import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {getColors} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {ensurePaused} from '@/features/music/guard';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder().setName('pause').setDescription('음악을 일시정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const client = getClient(interaction);

    const isPaused = await ensurePaused(interaction);
    if (!isPaused) return;

    await queue.pause(true);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 일시정지했어요.').setColor(getColors(client.config).normal)]});
  },
} satisfies Command;
