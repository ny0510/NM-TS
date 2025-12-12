import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, inlineCode} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {msToTime} from '@/utils/formatting';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';

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
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const timeStr = interaction.options.getString('time', true);
    const seconds = parseTimeToSeconds(timeStr);
    if (seconds === null)
      return safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle('시간 형식이 잘못되었어요.')
            .setDescription(`${inlineCode('시:분:초')} / ${inlineCode('분:초')} / ${inlineCode('초')} 형식으로 입력해 주세요.`)
            .setColor(client.config.EMBED_COLOR_ERROR),
        ],
      });
    if (seconds < 0) return safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('0초보다 작은 시간으로 건너뛸 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});

    const position = seconds * 1000;
    const currentTrack = await player.queue.getCurrent();
    if (!currentTrack) return safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('현재 재생중인 음악이 없어요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});
    if (position > currentTrack.duration)
      return safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle('음악의 길이보다 긴 시간으로 건너뛸 수 없어요.')
            .setDescription(`현재 재생중인 음악의 길이는 ${msToTime(currentTrack.duration)}에요.`)
            .setColor(client.config.EMBED_COLOR_ERROR),
        ],
      });
    if (player.paused) return safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('일시 정지 상태에서는 건너뛰기를 할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});
    if (currentTrack.isStream) return safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('스트리밍 음악은 건너뛸 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});
    if (!currentTrack.isSeekable) return safeReply(interaction, {embeds: [new EmbedBuilder().setTitle('이 트랙은 건너뛰기를 지원하지 않아요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});

    player.seek(position);
    await safeReply(interaction, {embeds: [new EmbedBuilder().setTitle(`${formatTime(seconds)}(으)로 건너뛰었어요.`).setColor(client.config.EMBED_COLOR_NORMAL)]});
  },
} as Command;
