import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import type {NMClient} from '@/client/Client';
import {ensureResumed, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';
import {safeReply} from '@/utils/discord/interactions';

export default {
  data: new SlashCommandBuilder().setName('resume').setDescription('일시정지된 음악을 다시 재생해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!player) return;

    const isResumed = await ensureResumed(interaction); // 음악이 일시정지 상태인지 확인
    if (!isResumed) return;

    player.pause(false);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 다시 재생했어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
