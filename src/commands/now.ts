import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';
import getColors from 'get-image-colors';

import type {Command} from '@/client/types';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {msToTime, truncateWithEllipsis} from '@/utils/formatting';
import {createProgressBar, ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';

export default {
  data: new SlashCommandBuilder().setName('now').setDescription('현재 재생중인 음악을 확인해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);

    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!queue) return;

    const track = queue.getCurrent()!;
    const colors = track.info.artworkUrl ? await getColors(track.info.artworkUrl.replace('webp', 'png'), {count: 1}) : [];
    const repeatState = queue.queueRepeat ? '대기열 반복 중' : queue.trackRepeat ? '현재 음악 반복 중' : '반복 중이 아님';
    const progressBar = createProgressBar(queue);
    const queueSize = queue.size();
    const queueDuration = queue.duration();

    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setDescription(`${queue.playing ? '▶️' : '⏸️'} ${hyperlink(truncateWithEllipsis(track.info.title, 50), track.info.uri ?? '')}${!track.info.isStream ? `\n\n${progressBar}` : ''}`)
          .setThumbnail(track.info.artworkUrl ?? null)
          .setFields([
            {
              name: '곡 길이',
              value: inlineCode(`${track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length)}`),
              inline: true,
            },
            {
              name: '남은 대기열',
              value: inlineCode(`${queueSize}곡 (${msToTime(queueDuration)})`),
              inline: true,
            },
            {
              name: '볼륨',
              value: inlineCode(`${queue.volume}%`),
              inline: true,
            },
            {
              name: '반복',
              value: inlineCode(`${repeatState}`),
              inline: true,
            },
            {
              name: '추천 음악 자동 재생',
              value: inlineCode(queue.isAutoplay ? '활성화 됨' : '비활성화 됨'),
              inline: true,
            },
            {
              name: '요청자',
              value: `${typeof track.requester === 'string' ? track.requester : track.requester?.id ? `<@${track.requester.id}>` : '알 수 없음'}`,
              inline: true,
            },
          ])
          .setColor((colors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
      ],
    });
  },
} as Command;
