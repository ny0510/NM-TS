import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePaused, ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('pause').setDescription('음악을 일시정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const isPaused = await ensurePaused(interaction);
    if (!isPaused) return;

    await queue.pause(true);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 일시정지했어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} satisfies Command;
