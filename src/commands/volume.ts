import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('볼륨을 조절해요.')
    .addNumberOption(option => option.setName('level').setDescription('🔊 변경할 볼륨 크기 (0 ~ 100)').setMinValue(0).setMaxValue(100).setRequired(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const client = getClient(interaction);

    const level = interaction.options.getNumber('level', true);

    await queue.setVolume(level);

    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`볼륨을 ${level}%로 설정했어요.`).setDescription('반영되기까지 약 10초 가량이 소요될 수 있어요.').setColor(COLORS.normal)]});
  },
} satisfies Command;
