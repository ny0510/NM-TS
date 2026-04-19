import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('음악을 건너뛰어요.')
    .addIntegerOption(option => option.setName('count').setDescription('건너뛸 음악의 개수를 입력해 주세요.').setRequired(false)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const count = interaction.options.getInteger('count') ?? 1;
    const queueSize = queue.size();

    if (count < 1)
      return await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '건너뛸 음악의 개수는 1 이상이어야 해요.')],
        flags: MessageFlags.Ephemeral,
      });
    if (count > queueSize)
      return await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '대기열에 있는 음악보다 더 많은 곡을 건너뛸 수 없어요.', `대기열에 ${queueSize}곡이 있어요.`)],
        flags: MessageFlags.Ephemeral,
      });

    await queue.stop(count);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`${count}곡을 건너뛰었어요.`).setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} satisfies Command;
