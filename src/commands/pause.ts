import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePaused, ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('pause').setDescription('음악을 일시정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const player = client.manager.players.get(interaction.guildId!);
    if (!player) return;

    const isPaused = await ensurePaused(interaction);
    if (!isPaused) return;

    player.pause(true);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 일시정지했어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
