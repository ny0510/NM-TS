import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {withPlaybackSession} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('pause').setDescription('음악이나 라디오를 일시정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await withPlaybackSession(interaction, async queue => {
      if (queue.paused) {
        await safeReply(interaction, {content: '이미 일시정지 상태예요.'});
        return;
      }
      await queue.pause(true);
      await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(queue.mode === 'radio' ? '라디오를 일시정지했어요.' : '음악을 일시정지했어요.').setColor(COLORS.normal)]});
    });
  },
} satisfies Command;
