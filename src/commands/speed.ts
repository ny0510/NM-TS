import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {getColors} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder()
    .setName('speed')
    .setDescription('재생 속도를 조절해요.')
    .addNumberOption(option => option.setName('level').setDescription('⏩ 변경할 재생 속도 (0.5 ~ 2.0)').setMinValue(0.5).setMaxValue(2.0).setRequired(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const client = getClient(interaction);

    const level = interaction.options.getNumber('level', true);

    await queue.setTimescale({
      speed: level,
      pitch: 1.0,
      rate: 1.0,
    });

    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`재생 속도를 ${level}배로 설정했어요.`).setDescription('반영되기까지 약 10초 가량이 소요될 수 있어요.').setColor(getColors(client.config).normal)]});
  },
} satisfies Command;
