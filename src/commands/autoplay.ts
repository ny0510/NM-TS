import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('autoplay').setDescription('자동 재생을 설정해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const enabled = queue.isAutoplay;

    if (!enabled) {
      await interaction.deferReply();
      queue.setAutoplay(true, interaction.user);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 활성화했어요!').setDescription('마지막 곡이 끝나면 자동으로 비슷한 곡을 재생해요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    } else {
      queue.setAutoplay(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 비활성화했어요.').setDescription('더 이상 관련 음악을 자동으로 추가하지 않아요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    }
  },
} as Command;
