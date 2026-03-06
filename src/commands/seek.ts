import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, inlineCode} from 'discord.js';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';
import {msToTime} from '@/utils/formatting';
import {ensurePlayerReady} from '@/utils/music';

const parseTimeToSeconds = (time: string): number | null => {
  if (/^\d+$/.test(time)) return parseInt(time, 10);

  const match = time.match(/^(\d{1,2}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!match) return null;
  const [h, m, s] = match.slice(1).map(Number);
  if (match[3]) return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  return (h || 0) * 60 + (m || 0);
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;

  let result = '';
  if (h) result += `${h}시간 `;
  if (m) result += `${m}분 `;
  if (s || (!h && !m)) result += `${s}초`;
  return result.trim();
};

export default {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('지정한 시간으로 건너뛰어요.')
    .addStringOption(option => option.setName('time').setDescription('건너뛸 시간 (시:분:초)').setRequired(true)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const timeStr = interaction.options.getString('time', true);
    const seconds = parseTimeToSeconds(timeStr);
    if (seconds === null)
      return safeReply(interaction, {
        embeds: [createErrorEmbed(client, '시간 형식이 잘못되었어요.', `${inlineCode('시:분:초')} / ${inlineCode('분:초')} / ${inlineCode('초')} 형식으로 입력해 주세요.`)],
      });
    if (seconds < 0) return safeReply(interaction, {embeds: [createErrorEmbed(client, '0초보다 작은 시간으로 건너뛸 수 없어요.')], flags: MessageFlags.Ephemeral});

    const position = seconds * 1000;
    const currentTrack = queue.getCurrent();
    if (!currentTrack) return safeReply(interaction, {embeds: [createErrorEmbed(client, '현재 재생중인 음악이 없어요.')], flags: MessageFlags.Ephemeral});
    if (position > currentTrack.info.length)
      return safeReply(interaction, {
        embeds: [createErrorEmbed(client, '음악의 길이보다 긴 시간으로 건너뛸 수 없어요.', `현재 재생중인 음악의 길이는 ${msToTime(currentTrack.info.length)}에요.`)],
      });
    if (queue.paused) return safeReply(interaction, {embeds: [createErrorEmbed(client, '일시 정지 상태에서는 건너뛰기를 할 수 없어요.')], flags: MessageFlags.Ephemeral});
    if (currentTrack.info.isStream) return safeReply(interaction, {embeds: [createErrorEmbed(client, '스트리밍 음악은 건너뛸 수 없어요.')], flags: MessageFlags.Ephemeral});
    if (!currentTrack.info.isSeekable) return safeReply(interaction, {embeds: [createErrorEmbed(client, '이 트랙은 건너뛰기를 지원하지 않아요.')], flags: MessageFlags.Ephemeral});

    await queue.seek(position);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`${formatTime(seconds)}(으)로 건너뛰었어요.`).setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
