import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder().setName('stop').setDescription('음악을 정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    const inVoice = await ensureVoiceChannel(interaction); // 음성 채널에 들어가 있는지 확인
    const inSameVoice = await ensureSameVoiceChannel(interaction); // 같은 음성 채널에 있는지 확인
    const isPlaying = await ensurePlaying(interaction); // 음악이 재생중인지 확인
    if (!inVoice || !inSameVoice || !isPlaying || !player) return;

    player.set('stoppedByCommand', true);
    player.destroy();

    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('음악을 정지했어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
    });
  },
} as Command;
