import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder().setName('clear').setDescription('대기열을 비워요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    const inVoice = await ensureVoiceChannel(interaction); // 음성 채널에 들어가 있는지 확인
    const inSameVoice = await ensureSameVoiceChannel(interaction); // 같은 음성 채널에 있는지 확인
    const isPlaying = await ensurePlaying(interaction); // 음악이 재생중인지 확인
    if (!inVoice || !inSameVoice || !isPlaying || !player) return;

    player.queue.clear();

    return await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('대기열을 비웠어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
    });
  },
} as Command;
