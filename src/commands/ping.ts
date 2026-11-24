import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {DateTime} from 'luxon';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {safeDeferReply, safeEditReply} from '@/shared/discord/interactions/safeReply';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('봇의 지연시간을 확인해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = getClient(interaction);

    const start = DateTime.fromMillis(interaction.createdTimestamp);
    if (!(await safeDeferReply(interaction))) return;

    const apiLatency = client.ws.ping;

    await safeEditReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle('🏓 당신은 퐁입니다')
          .setDescription(`⏱️ 봇 지연시간: **${DateTime.now().diff(start).toMillis()}ms**\n⌛ API 지연시간: **${apiLatency}ms**`)
          .setColor(COLORS.normal)
          .setTimestamp(),
      ],
    });
  },
} satisfies Command;
