import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {withPlaybackSession} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('resume').setDescription('일시정지된 음악이나 라디오를 다시 재생해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await withPlaybackSession(interaction, async queue => {
      if (!queue.paused) {
        await safeReply(interaction, {content: '이미 재생 중이에요.'});
        return;
      }
      await queue.pause(false);
      await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(queue.mode === 'radio' ? '라디오를 다시 재생했어요.' : '음악을 다시 재생했어요.').setColor(COLORS.normal)]});
    });
  },
} satisfies Command;
