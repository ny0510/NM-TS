import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, codeBlock} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('음악을 건너뛰어요.')
    .addIntegerOption(option => option.setName('count').setDescription('건너뛸 음악의 개수를 입력해 주세요.').setRequired(false)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const count = interaction.options.getInteger('count') ?? 1;
    const queueSize = await player.queue.size();

    if (count < 1)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('건너뛸 음악의 개수는 1 이상이어야 해요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    if (count > queueSize)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('대기열에 있는 음악보다 더 많은 곡을 건너뛸 수 없어요.').setDescription(`대기열에 ${queueSize}곡이 있어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });

    player.stop(count);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`${count}곡을 건너뛰었어요.`).setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
