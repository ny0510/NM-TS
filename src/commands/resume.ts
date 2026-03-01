import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady, ensureResumed} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('resume').setDescription('일시정지된 음악을 다시 재생해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await ensurePlayerReady(interaction))) return;

    const client = getClient(interaction);
    const player = client.manager.players.get(interaction.guildId!);
    if (!player) return;

    const isResumed = await ensureResumed(interaction);
    if (!isResumed) return;

    player.pause(false);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 다시 재생했어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
