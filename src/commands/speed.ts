import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import type {NMClient} from '@/client/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';
import {safeReply} from '@/utils/discord/interactions';

export default {
  data: new SlashCommandBuilder()
    .setName('speed')
    .setDescription('재생 속도를 조절해요.')
    .addNumberOption(option => option.setName('level').setDescription('재생 속도').setMinValue(0.5).setMaxValue(2.0).setRequired(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const level = interaction.options.getNumber('level', true);

    player.filters.setTimescale({
      speed: level,
      pitch: 1.0,
      rate: 1.0,
    });

    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`재생 속도를 ${level}배로 설정했어요.`).setDescription('반영되기까지 약 10초 가량이 소요될 수 있어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
