import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('autoshuffle').setDescription('노래가 추가될 때마다 자동으로 대기열을 셔플해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const enabled = queue.isAutoShuffle;
    queue.setAutoShuffle(!enabled);

    if (!enabled) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 셔플을 활성화했어요.').setDescription('노래가 추가될 때마다 대기열을 자동으로 섞어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    } else {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 셔플을 비활성화했어요.').setDescription('더 이상 자동으로 대기열을 섞지 않아요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    }
  },
} as Command;
