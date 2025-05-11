import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('볼륨을 조절해요.')
    .addNumberOption(option => option.setName('level').setDescription('볼륨').setMinValue(0).setMaxValue(100).setRequired(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const level = interaction.options.getNumber('level', true);

    player.setVolume(level);

    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`볼륨을 ${level}%로 설정했어요.`).setDescription('반영되기까지 약 10초 가량이 소요될 수 있어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
