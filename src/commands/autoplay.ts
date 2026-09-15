import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {validateMusicCommand} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('autoplay').setDescription('자동 재생을 설정해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    if (queue.isAutoplay) {
      queue.setAutoplay(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 비활성화했어요.').setDescription('더 이상 관련 음악을 자동으로 추가하지 않아요.').setColor(COLORS.normal)],
      });
    }

    await interaction.deferReply();
    queue.setAutoplay(true, interaction.user);

    return await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('자동 재생을 활성화했어요!').setDescription('마지막 곡이 끝나면 자동으로 비슷한 곡을 재생해요.').setColor(COLORS.normal)],
    });
  },
} satisfies Command;
