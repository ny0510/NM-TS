import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {destroyQueueSafely, ensurePlayerReady, ensurePlaying} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('stop').setDescription('음악을 정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    queue.set('stoppedByCommand', true);
    await destroyQueueSafely(client, queue.guildId);

    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('음악을 정지했어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
    });
  },
} as Command;
