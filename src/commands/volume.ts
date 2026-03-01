import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('볼륨을 조절해요.')
    .addNumberOption(option => option.setName('level').setDescription('볼륨').setMinValue(0).setMaxValue(100).setRequired(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const player = client.manager.players.get(interaction.guildId!);
    if (!player) return;

    const level = interaction.options.getNumber('level', true);

    player.setVolume(level);

    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`볼륨을 ${level}%로 설정했어요.`).setDescription('반영되기까지 약 10초 가량이 소요될 수 있어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
