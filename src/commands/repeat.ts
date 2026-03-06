import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

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

    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    if (subcommand === 'track') {
      const enabled = !queue.trackRepeat;
      queue.setTrackRepeat(enabled);
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle(`현재 음악 반복을 ${enabled ? '활성화' : '비활성화'}했어요.`).setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    } else if (subcommand === 'queue') {
      const enabled = !queue.queueRepeat;
      const description = enabled && queue.trackRepeat ? '현재 음악 반복이 활성화된 상태여서 자동으로 비활성화했어요.' : ' ';

      queue.setQueueRepeat(enabled);
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle(`대기열 반복을 ${enabled ? '활성화' : '비활성화'}했어요.`)
            .setDescription(description)
            .setColor(client.config.EMBED_COLOR_NORMAL),
        ],
      });
    } else if (subcommand === 'off') {
      const trackRepeat = queue.trackRepeat;
      const queueRepeat = queue.queueRepeat;

      if (!trackRepeat && !queueRepeat) {
        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle('반복 재생이 비활성화된 상태에요.').setColor(client.config.EMBED_COLOR_NORMAL)],
          flags: MessageFlags.Ephemeral,
        });
      }

      queue.setTrackRepeat(false);
      queue.setQueueRepeat(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('반복 재생을 해제했어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    }
  },
} as Command;
