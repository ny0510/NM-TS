import {calculateQueueDuration, formatMusicDuration} from '@/features/music/queue/duration';
import type {Queue} from '@/features/music/queue/Queue';
import {msToTime} from '@/shared/formatting';
import {isRadioTrack} from '@/shared/playback/radioUrl';
import type {QueueTrack} from '@/types/music';
import {getAlbumColors} from './colors';

function getQueueInfo(queue: Queue) {
  const queueSize = queue.size();
  const actualQueueDuration = calculateQueueDuration(queue.getTracks(), null);
  return {queueSize, actualQueueDuration};
}

export const getEmbedMeta = async (trackOrTracks: QueueTrack | QueueTrack[], isPlaylist: boolean, queue: Queue, action?: 'play' | 'add') => {
  if (isPlaylist) {
    const tracks = trackOrTracks as QueueTrack[];
    const firstTrack = tracks[0];
    const colors = await getAlbumColors(firstTrack?.info.artworkUrl);
    const playlistDuration = calculateQueueDuration(tracks, null);
    const {queueSize, actualQueueDuration} = getQueueInfo(queue);
    const footerText = `추가된 음악 ${tracks.length}곡 · ${formatMusicDuration(playlistDuration)} | 대기열에 ${queueSize}곡 · ${formatMusicDuration(actualQueueDuration)}`;
    return {colors, footerText};
  } else {
    const track = trackOrTracks as QueueTrack;
    const colors = await getAlbumColors(track.info.artworkUrl);
    const actionText = action === 'add' ? '추가된' : '재생중인';
    const {queueSize, actualQueueDuration} = getQueueInfo(queue);
    const footerText = `${actionText} ${isRadioTrack(track) ? '라디오' : '음악'} · ${track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length)} | 대기열에 ${queueSize}곡 · ${formatMusicDuration(actualQueueDuration)}`;
    return {colors, footerText};
  }
};
