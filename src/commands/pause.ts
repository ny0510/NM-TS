import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePaused, ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder().setName('pause').setDescription('음악을 일시정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const isPaused = await ensurePaused(interaction); // 음악이 일시정지 상태인지 확인
    if (!isPaused) return;

    player.pause(true);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('음악을 일시정지했어요.').setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
