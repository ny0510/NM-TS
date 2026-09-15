import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {validateMusicCommand} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('autoshuffle').setDescription('노래가 추가될 때마다 자동으로 대기열을 셔플해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const enabled = queue.isAutoShuffle;
    queue.setAutoShuffle(!enabled);

    if (enabled) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 셔플을 비활성화했어요.').setDescription('더 이상 자동으로 대기열을 섞지 않아요.').setColor(COLORS.normal)],
      });
    }

    return await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('자동 셔플을 활성화했어요.').setDescription('노래가 추가될 때마다 대기열을 자동으로 섞어요.').setColor(COLORS.normal)],
    });
  },
} satisfies Command;
