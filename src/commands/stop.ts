import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {withPlaybackSession} from '@/features/music/guard';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('stop').setDescription('음악이나 라디오를 정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await withPlaybackSession(interaction, async (queue, context) => {
      queue.set('stoppedByCommand', true);
      await context.destroySession(queue.sessionId);
      await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(queue.mode === 'radio' ? '라디오를 정지했어요.' : '음악을 정지했어요.').setColor(COLORS.normal)]});
    });
  },
} satisfies Command;
