import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('반복 재생을 설정해요.')
    .addSubcommand(sub => sub.setName('track').setDescription('현재 음악을 반복 재생해요.'))
    .addSubcommand(sub => sub.setName('queue').setDescription('대기열 전체를 반복 재생해요.'))
    .addSubcommand(sub => sub.setName('off').setDescription('반복 재생을 해제해요.')),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const client = getClient(interaction);

    if (subcommand === 'track') {
      const enabled = !queue.trackRepeat;
      queue.setTrackRepeat(enabled);
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle(`현재 음악 반복을 ${enabled ? '활성화' : '비활성화'}했어요.`).setColor(COLORS.normal)],
      });
    } else if (subcommand === 'queue') {
      const enabled = !queue.queueRepeat;

      queue.setQueueRepeat(enabled);
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle(`대기열 반복을 ${enabled ? '활성화' : '비활성화'}했어요.`)
            .setDescription(enabled && queue.trackRepeat ? '현재 음악 반복이 활성화된 상태여서 자동으로 비활성화했어요.' : null)
            .setColor(COLORS.normal),
        ],
      });
    } else if (subcommand === 'off') {
      const trackRepeat = queue.trackRepeat;
      const queueRepeat = queue.queueRepeat;

      if (!trackRepeat && !queueRepeat) {
        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle('반복 재생이 비활성화된 상태에요.').setColor(COLORS.normal)],
          flags: MessageFlags.Ephemeral,
        });
      }

      queue.setTrackRepeat(false);
      queue.setQueueRepeat(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('반복 재생을 해제했어요.').setColor(COLORS.normal)],
      });
    }
  },
} satisfies Command;
