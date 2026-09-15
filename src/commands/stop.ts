import {type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {validateMusicCommand} from '@/features/music/guard';
import {destroyQueueSafely} from '@/features/music/queue/queueOperations';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import type {Command} from '@/types/client';

export const command = {
  data: new SlashCommandBuilder().setName('stop').setDescription('음악을 정지해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const client = getClient(interaction);

    queue.set('stoppedByCommand', true);
    await destroyQueueSafely(client, queue.guildId);

    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('음악을 정지했어요.').setColor(COLORS.normal)],
    });
  },
} satisfies Command;
