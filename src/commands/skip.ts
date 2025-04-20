import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, codeBlock} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('음악을 건너뛰어요.')
    .addIntegerOption(option => option.setName('count').setDescription('건너뛸 음악의 개수를 입력해 주세요.').setRequired(false)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    const inVoice = await ensureVoiceChannel(interaction); // 음성 채널에 들어가 있는지 확인
    const inSameVoice = await ensureSameVoiceChannel(interaction); // 같은 음성 채널에 있는지 확인
    const isPlaying = await ensurePlaying(interaction); // 음악이 재생중인지 확인
    if (!inVoice || !inSameVoice || !isPlaying || !player) return;

    const count = interaction.options.getInteger('count') ?? 1;

    if (count < 1)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('건너뛸 음악의 개수는 1 이상이어야 해요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    if (count > player.queue.length)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('대기열에 있는 음악보다 더 많은 곡을 건너뛸 수 없어요.').setDescription(`대기열에 ${player.queue.length}곡이 있어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });

    player.stop(count);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`${count}곡을 건너뛰었어요.`).setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
