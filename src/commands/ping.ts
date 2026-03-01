import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {DateTime} from 'luxon';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('봇의 지연시간을 확인해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = getClient(interaction);

    const start = DateTime.now();
    await interaction.deferReply();

    const apiLatency = client.ws.ping;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏓 당신은 퐁입니다')
          .setDescription(`⏱️ 봇 지연시간: **${DateTime.now().diff(start).toMillis()}ms**\n⌛ API 지연시간: **${apiLatency}ms**`)
          .setColor(client.config.EMBED_COLOR_NORMAL)
          .setTimestamp(),
      ],
    });
  },
} as Command;
