import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('autoplay').setDescription('자동 재생을 설정해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const enabled = player.isAutoplay;

    if (!enabled) {
      await interaction.deferReply();
      player.setAutoplay(true, interaction.user);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 활성화했어요!').setDescription('마지막 곡이 끝나면 자동으로 비슷한 곡을 재생해요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    } else {
      player.setAutoplay(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 비활성화했어요.').setDescription('더 이상 관련 음악을 자동으로 추가하지 않아요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    }
  },
} as Command;
