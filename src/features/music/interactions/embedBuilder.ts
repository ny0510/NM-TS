import {EmbedBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import type {QueueTrack} from '@/types/music';
import {getColors} from '@/shared/discord/embedColors';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/shared/formatting';

export const TRACKS_PER_PAGE = 10;

export function buildQueueEmbed(client: NMClient, queue: Queue, page: number): EmbedBuilder {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = start + TRACKS_PER_PAGE;
  const tracks = queue.getSlice(start, end);
  const currentTrack = queue.getCurrent();
  const totalTracks = queue.size();
  const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
  const queueDuration = queue.duration();
  const footer = totalPages > 1 ? `${page}/${totalPages} 페이지\n+${Math.max(0, totalTracks - page * TRACKS_PER_PAGE)}곡` : ' ';

  const trackList = tracks.map((track: QueueTrack, i: number) => ({
    name: `${start + i + 1}. ${truncateWithEllipsis(track.info.title, 50)}`,
    value: `┕ ${track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length)} | ${typeof track.requester === 'string' ? track.requester : track.requester?.id ? `<@${track.requester.id}>` : '알 수 없음'}`,
  }));

  return new EmbedBuilder()
    .setTitle(`📋 현재 대기열 (${msToTime(queueDuration)})`)
    .setDescription(currentTrack ? hyperlink(truncateWithEllipsis(`⏵ ${currentTrack.info.title}`, 50), currentTrack.info.uri ?? '') : '현재 재생중인 음악이 없어요.')
    .addFields(trackList)
    .setFooter({text: footer})
    .setColor(getColors(client.config).normal);
}
