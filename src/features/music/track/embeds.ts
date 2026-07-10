import type {Queue} from '@/features/music/queue/Queue';
import type {QueueTrack} from '@/types/music';
import {msToTime} from '@/shared/formatting';
import {getAlbumColors} from './colors';

function getQueueInfo(queue: Queue) {
  const queueSize = queue.size();
  const queueDuration = queue.duration();
  const currentTrack = queue.getCurrent();
  const actualQueueDuration = currentTrack ? queueDuration - (currentTrack.info.length ?? 0) : queueDuration;
  return {queueSize, actualQueueDuration};
}

export const getEmbedMeta = async (trackOrTracks: QueueTrack | QueueTrack[], isPlaylist: boolean, queue: Queue, action?: 'play' | 'add') => {
  if (isPlaylist) {
    const tracks = trackOrTracks as QueueTrack[];
    const firstTrack = tracks[0];
    const colors = await getAlbumColors(firstTrack?.info.artworkUrl);
    const playlistDuration = tracks.reduce((acc, track) => acc + (track.info.length ?? 0), 0);
    const {queueSize, actualQueueDuration} = getQueueInfo(queue);
    const footerText = `추가된 음악 ${tracks.length}곡 · ${msToTime(playlistDuration)} | 대기열에 ${queueSize}곡 · ${msToTime(actualQueueDuration)}`;
    return {colors, footerText};
  } else {
    const track = trackOrTracks as QueueTrack;
    const colors = await getAlbumColors(track.info.artworkUrl);
    const actionText = action === 'add' ? '추가된' : '재생중인';
    const {queueSize, actualQueueDuration} = getQueueInfo(queue);
    const footerText = `${actionText} 음악 · ${track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length)} | 대기열에 ${queueSize}곡 · ${msToTime(actualQueueDuration)}`;
    return {colors, footerText};
  }
};
