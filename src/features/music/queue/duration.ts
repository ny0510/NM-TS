import {msToTime} from '@/shared/formatting';
import type {QueueTrack} from '@/types/music';

/** Calculate total duration of all tracks plus the current track. */
export const calculateQueueDuration = (tracks: QueueTrack[], current: QueueTrack | null): number => {
  const currentDuration = current?.info.isStream ? Infinity : (current?.info.length ?? 0);
  const queueDuration = tracks.reduce((acc, track) => acc + (track.info.isStream ? Infinity : (track.info.length ?? 0)), 0);
  return currentDuration + queueDuration;
};

export const formatMusicDuration = (duration: number): string => (duration === Infinity ? '실시간 스트리밍' : msToTime(duration));
